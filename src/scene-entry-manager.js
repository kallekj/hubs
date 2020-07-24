import qsTruthy from "./utils/qs_truthy";
import nextTick from "./utils/next-tick";
import pinnedEntityToGltf from "./utils/pinned-entity-to-gltf";
import { hackyMobileSafariTest } from "./utils/detect-touchscreen";

const isBotMode = qsTruthy("bot");
const isMobile = AFRAME.utils.device.isMobile();
const forceEnableTouchscreen = hackyMobileSafariTest();
const isMobileVR = AFRAME.utils.device.isMobileVR();
const isDebug = qsTruthy("debug");
const qs = new URLSearchParams(location.search);

import { addMedia, getPromotionTokenForFile } from "./utils/media-utils";
import {
  isIn2DInterstitial,
  handleExitTo2DInterstitial,
  exit2DInterstitialAndEnterVR,
  forceExitFrom2DInterstitial
} from "./utils/vr-interstitial";
import { ObjectContentOrigins } from "./object-types";
import { getAvatarSrc, getAvatarType } from "./utils/avatar-utils";
import { pushHistoryState } from "./utils/history";
import { SOUND_ENTER_SCENE } from "./systems/sound-effects-system";

const isIOS = AFRAME.utils.device.isIOS();

export default class SceneEntryManager {
  constructor(hubChannel, authChannel, history) {
    this.hubChannel = hubChannel;
    this.authChannel = authChannel;
    this.store = window.APP.store;
    this.mediaSearchStore = window.APP.mediaSearchStore;
    this.scene = document.querySelector("a-scene");
    this.rightCursorController = document.getElementById("right-cursor-controller");
    this.leftCursorController = document.getElementById("left-cursor-controller");
    this.avatarRig = document.getElementById("avatar-rig");
    this._entered = false;
    this.performConditionalSignIn = () => {};
    this.history = history;
  }

  init = () => {
    this.whenSceneLoaded(() => {
      this.rightCursorController.components["cursor-controller"].enabled = false;
      this.leftCursorController.components["cursor-controller"].enabled = false;
    });
    this.deskURLs = {
      b5: "https://uploads-prod.reticulum.io/files/ae0a49d5-4fa5-4087-a572-a104c470a320.glb",
      "eow-c": "https://uploads-prod.reticulum.io/files/09a3d5f6-8e7d-4cd3-b243-76bcc391a710.glb"
    };
  };

  hasEntered = () => {
    return this._entered;
  };
  // ------------------------------- CUSTOM CODE ------------------------------------
  loadAssetFromURL = (url, position) => {
    const el = document.createElement("a-entity");
    AFRAME.scenes[0].appendChild(el);
    el.setAttribute("media-loader", { src: url, fitToBox: false, resolve: true });
    el.setAttribute("networked", { template: "#interactable-media" });
    el.setAttribute("position", position);
    return el;
  };

  spawnDesks = () => {
    // Spawn the desk and position it
    const g = AFRAME.scenes[0].querySelectorAll("[class]");
    const deskGroups = [];
    for (let e of g) {
      if (e.className.substring(0, 10) == "Desk_Group") {
        deskGroups.push(e);
      }
    }
    const desks = [];
    const targets = [];
    for (let deskGroup of deskGroups) {
      for (let deskGroupChild of deskGroup.object3D.children) {
        // Find the invisible desks to link with
        if (deskGroupChild.name.substring(0, 14) == "Invisible_Desk") {
          const deskType = deskGroupChild.name.substring(15, deskGroupChild.name.length - 2);
          var newDeskPosition = Object.assign({}, deskGroupChild.el.object3D.getWorldPosition());
          // Load desk at correct position
          var newDesk = this.loadAssetFromURL(this.deskURLs[deskType.toLowerCase()], newDeskPosition);
          targets.push(deskGroupChild);
          newDesk.updateComponent("media-loader", { deskType: deskType });
          newDesk.updateComponent("media-loader", { invisibleDeskName: deskGroupChild.name });
          newDesk.updateComponent("media-loader", { objectType: "Interactive_Desk" });
          desks.push(newDesk);
        }
      }
    }
    for (var i = 0; i < desks.length; i++) {
      // Set rotation for desks
      desks[i].object3D.setRotationFromQuaternion(targets[i].el.object3D.getWorldQuaternion());
      desks[i].object3D.name = "Interactive_Desk_".concat(i);
      desks[i].currentHeightOffset = 0;
      desks[i].updateComponent("media-loader", { deskName: desks[i].object3D.name });
    }
    return desks;
  };
  degreeToRadians = degrees => {
    return (degrees * Math.PI) / 180;
  };
  getScreenOffsetsForDesk(deskType) {
    if (deskType.toLowerCase() === "b5") {
      return [
        { posX: -1.135, posY: 0.574, posZ: -0.222, rotX: 0, rotY: this.degreeToRadians(17.5), rotZ: 0 },
        {
          posX: -1.125,
          posY: 0.21,
          posZ: -0.185,
          rotX: this.degreeToRadians(-13),
          rotY: this.degreeToRadians(17.5),
          rotZ: this.degreeToRadians(0)
        },
        { posX: -0.572, posY: 0.574, posZ: -0.354, rotX: 0, rotY: this.degreeToRadians(8.7), rotZ: 0 },
        {
          posX: -0.572,
          posY: 0.21,
          posZ: -0.313,
          rotX: this.degreeToRadians(-13),
          rotY: this.degreeToRadians(8.5),
          rotZ: this.degreeToRadians(0)
        },
        { posX: 0, posY: 0.574, posZ: -0.391, rotX: 0, rotY: 0, rotZ: 0 },
        { posX: 0, posY: 0.21, posZ: -0.355, rotX: this.degreeToRadians(-13), rotY: 0, rotZ: 0 },

        { posX: 0.575, posY: 0.574, posZ: -0.355, rotX: 0, rotY: this.degreeToRadians(-8.7), rotZ: 0 },
        {
          posX: 0.575,
          posY: 0.21,
          posZ: -0.31,
          rotX: this.degreeToRadians(-13),
          rotY: this.degreeToRadians(-8.7),
          rotZ: 0
        },
        { posX: 1.14, posY: 0.574, posZ: -0.22, rotX: 0, rotY: this.degreeToRadians(-17.4), rotZ: 0 },
        {
          posX: 1.128,
          posY: 0.21,
          posZ: -0.18,
          rotX: this.degreeToRadians(-13.5),
          rotY: this.degreeToRadians(-17.4),
          rotZ: 0
        }
      ];
    } else if (deskType.toLowerCase() == "eow-c") {
      return [
        { posX: -0.625, posY: 0.7, posZ: -0.635, rotX: 0, rotY: this.degreeToRadians(6.3), rotZ: 0 },
        {
          posX: 0.465,
          posY: 0.7,
          posZ: -0.635,
          rotX: 0,
          rotY: this.degreeToRadians(-6.3),
          rotZ: 0
        },
        {
          posX: -0.935,
          posY: 0.18,
          posZ: -0.3,
          rotX: this.degreeToRadians(-13),
          rotY: this.degreeToRadians(12.5),
          rotZ: 0
        },
        {
          posX: -0.366,
          posY: 0.18,
          posZ: -0.39,
          rotX: this.degreeToRadians(-13),
          rotY: this.degreeToRadians(4),
          rotZ: 0
        },
        {
          posX: 0.206,
          posY: 0.18,
          posZ: -0.39,
          rotX: this.degreeToRadians(-13),
          rotY: this.degreeToRadians(-4),
          rotZ: 0
        },
        {
          posX: 0.767,
          posY: 0.18,
          posZ: -0.3,
          rotX: this.degreeToRadians(-13),
          rotY: this.degreeToRadians(-12.5),
          rotZ: 0
        }
      ];
    }
    return null;
  }
  getScreenScalesForDesk(deskType) {
    if (deskType.toLowerCase() === "b5") {
      return { x: 0.55, y: 0.58, z: 0.7 };
    } else if (deskType.toLowerCase() === "eow-c") {
      return [{ x: 1.08, y: 1.08, z: 1 }, { x: 0.55, y: 0.58, z: 0.7 }];
    }
    return null;
  }

  spawnSnapScreens = async desk => {
    const tempURL = "https://uploads-prod.reticulum.io/files/f1e8b354-6c4d-4b3a-b812-31a3571bf58d.png";
    // Get the correct position offset and scale of the snap objects for the current desk
    var snapObjectOffsets = this.getScreenOffsetsForDesk(desk.components["media-loader"].data.deskType);
    var snapObjectScales = this.getScreenScalesForDesk(desk.components["media-loader"].data.deskType);
    // If unknown desk name, don't continue
    if (snapObjectOffsets != null) {
      var deskPosition = Object.assign({}, desk.object3D.getWorldPosition());

      snapObjectOffsets.forEach(snapOffset => {
        var snapObject = this.loadAssetFromURL(tempURL, deskPosition);

        (async () => {
          while (snapObject.hasLoaded === false) {
            await nextTick();
          }
          if (snapObject.hasLoaded) {
            snapObject.object3D.setRotationFromQuaternion(desk.object3D.getWorldQuaternion());

            if (desk.components["media-loader"].data.deskType.toLowerCase() != "eow-c") {
              // Set correct scale for snap object
              snapObject.object3D.scale.x = snapObjectScales.x;
              snapObject.object3D.scale.y = snapObjectScales.y;
              snapObject.object3D.scale.z = snapObjectScales.z;
            } else {
              // Since EOW-c has both big and small monitors
              if (snapOffset.posY > 0.6) {
                // Set correct scale for snap object
                snapObject.object3D.scale.x = snapObjectScales[0].x;
                snapObject.object3D.scale.y = snapObjectScales[0].y;
                snapObject.object3D.scale.z = snapObjectScales[0].z;
              } else {
                snapObject.object3D.scale.x = snapObjectScales[1].x;
                snapObject.object3D.scale.y = snapObjectScales[1].y;
                snapObject.object3D.scale.z = snapObjectScales[1].z;
              }
            }

            // Move snap object to correct position offset
            snapObject.object3D.translateX(snapOffset.posX);
            snapObject.object3D.translateY(snapOffset.posY - 0.17);
            snapObject.object3D.translateZ(snapOffset.posZ);
            // Rotate snap object
            snapObject.object3D.rotation.x += snapOffset.rotX;
            snapObject.object3D.rotation.y += snapOffset.rotY;
            snapObject.object3D.rotation.z += snapOffset.rotZ;
            snapObject.object3D.translateZ(0.01);
            // Make snap object not moveable by mouse/oculus controller
            snapObject.removeAttribute("draggable");
            snapObject.removeAttribute("hoverable-visuals");
            snapObject.removeAttribute("is-remote-hover-target");
            // Assign name, desk and the current offset in Y axis
            snapObject.updateComponent("media-loader", { objectType: "SnapObject" });
            snapObject.object3D.name = "SnapObject";
            snapObject.isSnapObject = true;
            snapObject.updateComponent("media-loader", { deskName: desk.components["media-loader"].data.deskName });
            snapObject.desk = desk;
            snapObject.deskOffsetY = Math.fround(snapOffset.posY - 0.17);
          }
        })();
      });
    }
  };
  getEuclideanDistOfX_Z = (object1, object2) => {
    var x_distance = object1.x - object2.x;
    var z_distance = object1.z - object2.z;
    return Math.sqrt(x_distance * x_distance + z_distance * z_distance);
  };

  // ---------------------------------------------------------------------------------
  enterScene = async (mediaStream, enterInVR, muteOnEntry) => {
    document.getElementById("viewing-camera").removeAttribute("scene-preview-camera");

    if (isDebug && NAF.connection.adapter.session) {
      NAF.connection.adapter.session.options.verbose = true;
    }

    if (enterInVR) {
      // This specific scene state var is used to check if the user went through the
      // entry flow and chose VR entry, and is used to preempt VR mode on refreshes.
      this.scene.addState("vr-entered");

      // HACK - A-Frame calls getVRDisplays at module load, we want to do it here to
      // force gamepads to become live.
      "getVRDisplays" in navigator && navigator.getVRDisplays();

      await exit2DInterstitialAndEnterVR(true);
    }

    const waypointSystem = this.scene.systems["hubs-systems"].waypointSystem;
    waypointSystem.moveToSpawnPoint();

    if (isMobile || forceEnableTouchscreen || qsTruthy("mobile")) {
      this.avatarRig.setAttribute("virtual-gamepad-controls", {});
    }

    this._setupPlayerRig();
    this._setupBlocking();
    this._setupKicking();
    this._setupMedia(mediaStream);
    this._setupCamera();

    if (qsTruthy("offline")) return;

    this._spawnAvatar();

    this.scene.systems["hubs-systems"].soundEffectsSystem.playSoundOneShot(SOUND_ENTER_SCENE);

    if (isBotMode) {
      this._runBot(mediaStream);
      this.scene.addState("entered");
      this.hubChannel.sendEnteredEvent();
      return;
    }

    if (mediaStream) {
      await NAF.connection.adapter.setLocalMediaStream(mediaStream);
    }

    this.scene.classList.remove("hand-cursor");
    this.scene.classList.add("no-cursor");

    this.rightCursorController.components["cursor-controller"].enabled = true;
    this.leftCursorController.components["cursor-controller"].enabled = true;
    this._entered = true;

    // Delay sending entry event telemetry until VR display is presenting.
    (async () => {
      while (enterInVR && !this.scene.renderer.vr.isPresenting()) {
        await nextTick();
      }

      this.hubChannel.sendEnteredEvent().then(() => {
        this.store.update({ activity: { lastEnteredAt: new Date().toISOString() } });
      });
    })();

    // Bump stored entry count after 30s
    setTimeout(() => this.store.bumpEntryCount(), 30000);

    this.scene.addState("entered");

    if (muteOnEntry) {
      this.scene.emit("action_mute");
    }

    // ----------------------- CUSTOM -----------------------------------------------------------------------------
    var floaty_objects = AFRAME.scenes[0].querySelectorAll("[floaty-object]");

    var scene_objects = AFRAME.scenes[0].querySelectorAll("[class]");
    var invisible_desks = [];
    var desksAlreadySpawned = false;
    // Get the invisible desks of the scene
    for (let e of scene_objects) {
      if (e.object3D != null) {
        if (e.object3D.name.substring(0, 14) == "Invisible_Desk") {
          invisible_desks.push(e);
        }
      }
    }
    // Determine if interactive desks already are spawned
    var interactive_desks = [];
    for (let floaty_object of floaty_objects) {
      if (floaty_object.components["media-loader"] != null) {
        if (floaty_object.components["media-loader"].data.objectType == "Interactive_Desk") {
          desksAlreadySpawned = true;
          // If desks are spawned, find the corresponding invisible desk and link them together
          for (let inv_desk of invisible_desks) {
            if (inv_desk.object3D.name == floaty_object.components["media-loader"].data.invisibleDeskName) {
              floaty_object.invisible_desk = inv_desk;
              floaty_object.object3D.name = "Interactive_Desk".concat(
                inv_desk.object3D.name.substring(14, inv_desk.object3D.name.length)
              );
            }
          }
          // Make desk not draggable
          floaty_object.removeAttribute("draggable");
          floaty_object.removeAttribute("hoverable-visuals");
          floaty_object.removeAttribute("is-remote-hover-target");
          floaty_object.updateComponent("tags", { isHoldable: false });
          interactive_desks.push(floaty_object);
        }
      }
    }

    if (desksAlreadySpawned) {
      // Find the snap objects
      for (let floaty_object of floaty_objects) {
        if (floaty_object.object3D != null) {
          if (floaty_object.components["media-loader"].data.objectType == "SnapObject") {
            // Give correct object3D name and make not draggable
            floaty_object.object3D.name = "SnapObject";
            floaty_object.removeAttribute("draggable");
            floaty_object.removeAttribute("hoverable-visuals");
            floaty_object.removeAttribute("is-remote-hover-target");

            // Find the corresponding interactive desk of the snap object
            for (let desk of interactive_desks) {
              if (
                desk.components["media-loader"].data.deskName == floaty_object.components["media-loader"].data.deskName
              ) {
                // Link together the snap object and interactive desk
                floaty_object.desk = desk;
              }
            }
            floaty_object.deskOffsetY =
              floaty_object.object3D.getWorldPosition().y - floaty_object.desk.object3D.getWorldPosition().y;
          }
        }
      }
    }

    if (!desksAlreadySpawned) {
      // Spawn the interactive desks
      var spawnedDesks = this.spawnDesks();
      spawnedDesks.forEach(desk => {
        (async () => {
          while (desk.hasLoaded === false) {
            await nextTick();
          }
          // Make desks not draggable
          desk.removeAttribute("draggable");
          desk.removeAttribute("hoverable-visuals");
          desk.removeAttribute("is-remote-hover-target");
          desk.updateComponent("tags", { isHoldable: false });
          // move slightly because of offset in desk shape
          desk.object3D.translateZ(-0.01);
          desk.object3D.translateY(0.17);
          // link together the interactive desk and invisible desk
          desk.invisible_desk = invisible_desks[spawnedDesks.indexOf(desk)];
          desk.YAxisOffset = 0;
          // If of model EOW-c, hubs centers the object incorrectly so a slight offset has to be done
          if (desk.components["media-loader"].data.deskType.toLowerCase() == "eow-c") {
            desk.object3D.translateX(0.08);
            desk.object3D.translateZ(0.09);
          }
          this.spawnSnapScreens(desk);
        })();
      });
    }

    const avatarPOV = document.getElementById("avatar-pov-node");
    var avatarHeight = avatarPOV.object3D.matrixWorld.elements[13] - this.avatarRig.object3D.matrixWorld.elements[13];
    this.avatarRig.initialHeight = Math.round((avatarHeight + Number.EPSILON) * 100) / 100;

    // --------------------------------------------------------------------------------------------------------------------
  };

  whenSceneLoaded = callback => {
    if (this.scene.hasLoaded) {
      callback();
    } else {
      this.scene.addEventListener("loaded", callback);
    }
  };

  enterSceneWhenLoaded = (mediaStream, enterInVR) => {
    this.whenSceneLoaded(() => this.enterScene(mediaStream, enterInVR));
  };

  exitScene = () => {
    console.log("TEST");
    this.scene.exitVR();
    if (NAF.connection.adapter && NAF.connection.adapter.localMediaStream) {
      NAF.connection.adapter.localMediaStream.getTracks().forEach(t => t.stop());
    }
    if (this.hubChannel) {
      this.hubChannel.disconnect();
    }
    if (this.scene.renderer) {
      this.scene.renderer.setAnimationLoop(null); // Stop animation loop, TODO A-Frame should do this
    }
    this.scene.parentNode.removeChild(this.scene);
  };

  _setupPlayerRig = () => {
    this._setPlayerInfoFromProfile();

    // Explict user action changed avatar or updated existing avatar.
    this.scene.addEventListener("avatar_updated", () => this._setPlayerInfoFromProfile(true));

    // Store updates can occur to avatar id in cases like error, auth reset, etc.
    this.store.addEventListener("statechanged", () => this._setPlayerInfoFromProfile());

    const avatarScale = parseInt(qs.get("avatar_scale"), 10);
    if (avatarScale) {
      this.avatarRig.setAttribute("scale", { x: avatarScale, y: avatarScale, z: avatarScale });
    }
  };

  _setPlayerInfoFromProfile = async (force = false) => {
    const avatarId = this.store.state.profile.avatarId;
    if (!force && this._lastFetchedAvatarId === avatarId) return; // Avoid continually refetching based upon state changing

    this._lastFetchedAvatarId = avatarId;
    const avatarSrc = await getAvatarSrc(avatarId);

    this.avatarRig.setAttribute("player-info", { avatarSrc, avatarType: getAvatarType(avatarId) });
  };

  _setupKicking = () => {
    // This event is only received by the kicker
    document.body.addEventListener("kicked", ({ detail }) => {
      const { clientId: kickedClientId } = detail;
      const { entities } = NAF.connection.entities;
      for (const id in entities) {
        const entity = entities[id];
        if (NAF.utils.getCreator(entity) !== kickedClientId) continue;

        if (entity.components.networked.data.persistent) {
          NAF.utils.takeOwnership(entity);
          this._unpinElement(entity);
          entity.parentNode.removeChild(entity);
        } else {
          NAF.entities.removeEntity(id);
        }
      }
    });
  };

  _setupBlocking = () => {
    document.body.addEventListener("blocked", ev => {
      NAF.connection.entities.removeEntitiesOfClient(ev.detail.clientId);
    });

    document.body.addEventListener("unblocked", ev => {
      NAF.connection.entities.completeSync(ev.detail.clientId, true);
    });
  };

  _pinElement = async el => {
    const { networkId } = el.components.networked.data;

    const { fileId, src } = el.components["media-loader"].data;

    let fileAccessToken, promotionToken;
    if (fileId) {
      fileAccessToken = new URL(src).searchParams.get("token");
      const storedPromotionToken = getPromotionTokenForFile(fileId);
      if (storedPromotionToken) {
        promotionToken = storedPromotionToken.promotionToken;
      }
    }

    const gltfNode = pinnedEntityToGltf(el);
    if (!gltfNode) return;
    el.setAttribute("networked", { persistent: true });
    el.setAttribute("media-loader", { fileIsOwned: true });

    try {
      await this.hubChannel.pin(networkId, gltfNode, fileId, fileAccessToken, promotionToken);
      this.store.update({ activity: { hasPinned: true } });
    } catch (e) {
      if (e.reason === "invalid_token") {
        await this.authChannel.signOut(this.hubChannel);
        this._signInAndPinOrUnpinElement(el);
      } else {
        console.warn("Pin failed for unknown reason", e);
      }
    }
  };

  _signInAndPinOrUnpinElement = (el, pin) => {
    const action = pin
      ? () => this._pinElement(el)
      : async () => {
          await this._unpinElement(el);
        };

    this.performConditionalSignIn(() => this.hubChannel.signedIn, action, pin ? "pin" : "unpin", () => {
      // UI pins/un-pins the entity optimistically, so we undo that here.
      // Note we have to disable the sign in flow here otherwise this will recurse.
      this._disableSignInOnPinAction = true;
      el.setAttribute("pinnable", "pinned", !pin);
      this._disableSignInOnPinAction = false;
    });
  };

  _unpinElement = el => {
    const components = el.components;
    const networked = components.networked;

    if (!networked || !networked.data || !NAF.utils.isMine(el)) return;

    const networkId = components.networked.data.networkId;
    el.setAttribute("networked", { persistent: false });

    const mediaLoader = components["media-loader"];
    const fileId = mediaLoader.data && mediaLoader.data.fileId;

    this.hubChannel.unpin(networkId, fileId);
  };

  _setupMedia = mediaStream => {
    const offset = { x: 0, y: 0, z: -1.5 };
    const spawnMediaInfrontOfPlayer = (src, contentOrigin) => {
      if (!this.hubChannel.can("spawn_and_move_media")) return;
      const { entity, orientation } = addMedia(
        src,
        "#interactable-media",
        contentOrigin,
        null,
        !(src instanceof MediaStream),
        true
      );
      orientation.then(or => {
        entity.setAttribute("offset-relative-to", {
          target: "#avatar-pov-node",
          offset,
          orientation: or
        });
      });

      return entity;
    };

    this.scene.addEventListener("add_media", e => {
      const contentOrigin = e.detail instanceof File ? ObjectContentOrigins.FILE : ObjectContentOrigins.URL;

      spawnMediaInfrontOfPlayer(e.detail, contentOrigin);
    });

    const handlePinEvent = (e, pinned) => {
      if (this._disableSignInOnPinAction) return;
      const el = e.detail.el;

      if (NAF.utils.isMine(el)) {
        this._signInAndPinOrUnpinElement(e.detail.el, pinned);
      }
    };

    this.scene.addEventListener("pinned", e => handlePinEvent(e, true));
    this.scene.addEventListener("unpinned", e => handlePinEvent(e, false));

    this.scene.addEventListener("object_spawned", e => {
      this.hubChannel.sendObjectSpawnedEvent(e.detail.objectType);
    });

    this.scene.addEventListener("action_spawn", () => {
      handleExitTo2DInterstitial(false, () => window.APP.mediaSearchStore.pushExitMediaBrowserHistory());
      window.APP.mediaSearchStore.sourceNavigateToDefaultSource();
    });

    this.scene.addEventListener("action_invite", () => {
      handleExitTo2DInterstitial(false, () => this.history.goBack());
      pushHistoryState(this.history, "overlay", "invite");
    });

    this.scene.addEventListener("action_kick_client", ({ detail: { clientId } }) => {
      this.performConditionalSignIn(
        () => this.hubChannel.can("kick_users"),
        async () => await window.APP.hubChannel.kick(clientId),
        "kick-user"
      );
    });

    this.scene.addEventListener("action_mute_client", ({ detail: { clientId } }) => {
      this.performConditionalSignIn(
        () => this.hubChannel.can("mute_users"),
        () => window.APP.hubChannel.mute(clientId),
        "mute-user"
      );
    });

    this.scene.addEventListener("action_vr_notice_closed", () => forceExitFrom2DInterstitial());

    document.addEventListener("paste", e => {
      if (
        (e.target.matches("input, textarea") || e.target.contentEditable === "true") &&
        document.activeElement === e.target
      )
        return;

      // Never paste into scene if dialog is open
      const uiRoot = document.querySelector(".ui-root");
      if (uiRoot && uiRoot.classList.contains("in-modal-or-overlay")) return;

      const url = e.clipboardData.getData("text");
      const files = e.clipboardData.files && e.clipboardData.files;
      if (url) {
        spawnMediaInfrontOfPlayer(url, ObjectContentOrigins.URL);
      } else {
        for (const file of files) {
          spawnMediaInfrontOfPlayer(file, ObjectContentOrigins.CLIPBOARD);
        }
      }
    });

    document.addEventListener("dragover", e => e.preventDefault());

    document.addEventListener("drop", e => {
      e.preventDefault();

      let url = e.dataTransfer.getData("url");

      if (!url) {
        // Sometimes dataTransfer text contains a valid URL, so try for that.
        try {
          url = new URL(e.dataTransfer.getData("text")).href;
        } catch (e) {
          // Nope, not this time.
        }
      }

      const files = e.dataTransfer.files;

      if (url) {
        spawnMediaInfrontOfPlayer(url, ObjectContentOrigins.URL);
      } else {
        for (const file of files) {
          spawnMediaInfrontOfPlayer(file, ObjectContentOrigins.FILE);
        }
      }
    });

    let currentVideoShareEntity;
    let isHandlingVideoShare = false;

    const shareVideoMediaStream = async (constraints, isDisplayMedia) => {
      if (isHandlingVideoShare) return;
      isHandlingVideoShare = true;

      let newStream;

      try {
        if (isDisplayMedia) {
          newStream = await navigator.mediaDevices.getDisplayMedia(constraints);
        } else {
          newStream = await navigator.mediaDevices.getUserMedia(constraints);
        }
      } catch (e) {
        isHandlingVideoShare = false;
        this.scene.emit("share_video_failed");
        return;
      }

      const videoTracks = newStream ? newStream.getVideoTracks() : [];

      if (videoTracks.length > 0) {
        newStream.getVideoTracks().forEach(track => mediaStream.addTrack(track));

        if (newStream && newStream.getAudioTracks().length > 0) {
          const audioSystem = this.scene.systems["hubs-systems"].audioSystem;
          audioSystem.addStreamToOutboundAudio("screenshare", newStream);
        }

        await NAF.connection.adapter.setLocalMediaStream(mediaStream);
        currentVideoShareEntity = spawnMediaInfrontOfPlayer(mediaStream, undefined);

        // Wire up custom removal event which will stop the stream.
        currentVideoShareEntity.setAttribute("emit-scene-event-on-remove", "event:action_end_video_sharing");
      }

      this.scene.emit("share_video_enabled", { source: isDisplayMedia ? "screen" : "camera" });
      this.scene.addState("sharing_video");
      isHandlingVideoShare = false;
    };

    this.scene.addEventListener("action_share_camera", () => {
      const constraints = {
        video: {
          width: isIOS ? { max: 1280 } : { max: 1280, ideal: 720 },
          frameRate: 30
        }
        //TODO: Capture audio from camera?
      };

      // check preferences
      const store = window.APP.store;
      const preferredCamera = store.state.preferences.preferredCamera || "default";
      switch (preferredCamera) {
        case "default":
          constraints.video.mediaSource = "camera";
          break;
        case "user":
        case "environment":
          constraints.video.facingMode = preferredCamera;
          break;
        default:
          constraints.video.deviceId = preferredCamera;
          break;
      }
      shareVideoMediaStream(constraints);
    });

    this.scene.addEventListener("action_share_screen", () => {
      shareVideoMediaStream(
        {
          video: {
            // Work around BMO 1449832 by calculating the width. This will break for multi monitors if you share anything
            // other than your current monitor that has a different aspect ratio.
            width: 720 * (screen.width / screen.height),
            height: 720,
            frameRate: 30
          },
          audio: {
            echoCancellation: window.APP.store.state.preferences.disableEchoCancellation === true ? false : true,
            noiseSuppression: window.APP.store.state.preferences.disableNoiseSuppression === true ? false : true,
            autoGainControl: window.APP.store.state.preferences.disableAutoGainControl === true ? false : true
          }
        },
        true
      );
    });

    this.scene.addEventListener("action_end_video_sharing", async () => {
      if (isHandlingVideoShare) return;
      isHandlingVideoShare = true;

      if (currentVideoShareEntity && currentVideoShareEntity.parentNode) {
        NAF.utils.takeOwnership(currentVideoShareEntity);
        currentVideoShareEntity.parentNode.removeChild(currentVideoShareEntity);
      }

      for (const track of mediaStream.getVideoTracks()) {
        track.stop(); // Stop video track to remove the "Stop screen sharing" bar right away.
        mediaStream.removeTrack(track);
      }

      const audioSystem = this.scene.systems["hubs-systems"].audioSystem;
      audioSystem.removeStreamFromOutboundAudio("screenshare");

      await NAF.connection.adapter.setLocalMediaStream(mediaStream);
      currentVideoShareEntity = null;

      this.scene.emit("share_video_disabled");
      this.scene.removeState("sharing_video");
      isHandlingVideoShare = false;
    });

    this.scene.addEventListener("action_selected_media_result_entry", async e => {
      // TODO spawn in space when no rights
      const { entry, selectAction } = e.detail;
      if (selectAction !== "spawn") return;

      const delaySpawn = isIn2DInterstitial() && !isMobileVR;
      await exit2DInterstitialAndEnterVR();

      // If user has HMD lifted up or gone through interstitial, delay spawning for now. eventually show a modal
      if (delaySpawn) {
        setTimeout(() => {
          spawnMediaInfrontOfPlayer(entry.url, ObjectContentOrigins.URL);
        }, 3000);
      } else {
        spawnMediaInfrontOfPlayer(entry.url, ObjectContentOrigins.URL);
      }
    });

    this.mediaSearchStore.addEventListener("media-exit", () => {
      exit2DInterstitialAndEnterVR();
    });
  };

  _setupCamera = () => {
    this.scene.addEventListener("action_toggle_camera", () => {
      if (!this.hubChannel.can("spawn_camera")) return;
      const myCamera = this.scene.systems["camera-tools"].getMyCamera();

      if (myCamera) {
        myCamera.parentNode.removeChild(myCamera);
      } else {
        const entity = document.createElement("a-entity");
        entity.setAttribute("networked", { template: "#interactable-camera" });
        entity.setAttribute("offset-relative-to", {
          target: "#avatar-pov-node",
          offset: { x: 0, y: 0, z: -1.5 }
        });
        this.scene.appendChild(entity);
      }
    });

    this.scene.addEventListener("photo_taken", e => this.hubChannel.sendMessage({ src: e.detail }, "photo"));
    this.scene.addEventListener("video_taken", e => this.hubChannel.sendMessage({ src: e.detail }, "video"));
  };

  _spawnAvatar = () => {
    this.avatarRig.setAttribute("networked", "template: #remote-avatar; attachTemplateToLocal: false;");
    this.avatarRig.setAttribute("networked-avatar", "");
    this.avatarRig.emit("entered");
  };

  _runBot = async mediaStream => {
    const audioEl = document.createElement("audio");
    let audioInput;
    let dataInput;

    // Wait for startup to render form
    do {
      audioInput = document.querySelector("#bot-audio-input");
      dataInput = document.querySelector("#bot-data-input");
      await nextTick();
    } while (!audioInput || !dataInput);

    const getAudio = () => {
      audioEl.loop = true;
      audioEl.muted = true;
      audioEl.crossorigin = "anonymous";
      audioEl.src = URL.createObjectURL(audioInput.files[0]);
      document.body.appendChild(audioEl);
    };

    if (audioInput.files && audioInput.files.length > 0) {
      getAudio();
    } else {
      audioInput.onchange = getAudio;
    }

    const camera = document.querySelector("#avatar-pov-node");
    const leftController = document.querySelector("#player-left-controller");
    const rightController = document.querySelector("#player-right-controller");
    const getRecording = () => {
      fetch(URL.createObjectURL(dataInput.files[0]))
        .then(resp => resp.json())
        .then(recording => {
          camera.setAttribute("replay", "");
          camera.components["replay"].poses = recording.camera.poses;

          leftController.setAttribute("replay", "");
          leftController.components["replay"].poses = recording.left.poses;
          leftController.removeAttribute("visibility-by-path");
          leftController.removeAttribute("track-pose");
          leftController.setAttribute("visible", true);

          rightController.setAttribute("replay", "");
          rightController.components["replay"].poses = recording.right.poses;
          rightController.removeAttribute("visibility-by-path");
          rightController.removeAttribute("track-pose");
          rightController.setAttribute("visible", true);
        });
    };

    if (dataInput.files && dataInput.files.length > 0) {
      getRecording();
    } else {
      dataInput.onchange = getRecording;
    }

    await new Promise(resolve => audioEl.addEventListener("canplay", resolve));
    mediaStream.addTrack(
      audioEl.captureStream
        ? audioEl.captureStream().getAudioTracks()[0]
        : audioEl.mozCaptureStream
          ? audioEl.mozCaptureStream().getAudioTracks()[0]
          : null
    );
    await NAF.connection.adapter.setLocalMediaStream(mediaStream);
    audioEl.play();
  };
}
