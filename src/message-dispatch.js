import "./utils/configs";
import { getAbsoluteHref } from "./utils/media-url-utils";
import { isValidSceneUrl } from "./utils/scene-url-utils";
import { messages } from "./utils/i18n";
import { spawnChatMessage } from "./react-components/chat-message";
import { SOUND_QUACK, SOUND_SPECIAL_QUACK } from "./systems/sound-effects-system";
import ducky from "./assets/models/DuckyMesh.glb";

let uiRoot;
// Handles user-entered messages
export default class MessageDispatch {
  constructor(scene, entryManager, hubChannel, addToPresenceLog, remountUI, mediaSearchStore) {
    this.scene = scene;
    this.entryManager = entryManager;
    this.hubChannel = hubChannel;
    this.addToPresenceLog = addToPresenceLog;
    this.remountUI = remountUI;
    this.mediaSearchStore = mediaSearchStore;
  }

  log = body => {
    this.addToPresenceLog({ type: "log", body });
  };

  dispatch = message => {
    if (message.startsWith("/")) {
      const commandParts = message.substring(1).split(/\s+/);
      this.dispatchCommand(commandParts[0], ...commandParts.slice(1));
      document.activeElement.blur(); // Commands should blur
    } else {
      this.hubChannel.sendMessage(message);
    }
  };

  dispatchCommand = async (command, ...args) => {
    const entered = this.scene.is("entered");
    uiRoot = uiRoot || document.getElementById("ui-root");
    const isGhost = !entered && uiRoot && uiRoot.firstChild && uiRoot.firstChild.classList.contains("isGhost");

    if (!entered && (!isGhost || command === "duck")) {
      this.addToPresenceLog({ type: "log", body: "You must enter the room to use this command." });
      return;
    }

    const avatarRig = document.querySelector("#avatar-rig");
    const scales = [0.0625, 0.125, 0.25, 0.5, 1.0, 1.5, 3, 5, 7.5, 12.5];
    const curScale = avatarRig.object3D.scale;
    let err;
    let physicsSystem;
    const captureSystem = this.scene.systems["capture-system"];

    switch (command) {
      case "fly":
        if (this.scene.systems["hubs-systems"].characterController.fly) {
          this.scene.systems["hubs-systems"].characterController.enableFly(false);
          this.addToPresenceLog({ type: "log", body: "Fly mode disabled." });
        } else {
          if (this.scene.systems["hubs-systems"].characterController.enableFly(true)) {
            this.addToPresenceLog({ type: "log", body: "Fly mode enabled." });
          }
        }
        break;

      // -------------------------------- CUSTOM CODE FOR one to be able to set a specific height ---------------------------
      case "height":
        if (args[0]) {
          if (args[0] == "reset") {
            if (avatarRig.components["player-info"].data.original_scale != null) {
              avatarRig.object3D.scale.set(
                avatarRig.components["player-info"].data.original_scale.x,
                avatarRig.components["player-info"].data.original_scale.y,
                avatarRig.components["player-info"].data.original_scale.z
              );
              avatarRig.object3D.matrixNeedsUpdate = true;
            }
            break;
          } else if (args[0] == "show") {
            var avatarPOV = document.getElementById("avatar-pov-node");
            var avatarHeight =
              avatarPOV.object3D.matrixWorld.elements[13] - avatarRig.object3D.matrixWorld.elements[13];
            this.addToPresenceLog({
              type: "log",
              body: "Current avatar height :"
                .concat(Math.round((avatarHeight + 0.3 + Number.EPSILON) * 100) / 100)
                .concat("m")
            });
          } else if (args[0] > 1 && args[0] < 2.5) {
            // Get the avatar POV
            var avatarPOV = document.getElementById("avatar-pov-node");
            // Calculate the current height of the avatar (source of method is a gist made by utophia)
            var avatarHeight =
              avatarPOV.object3D.matrixWorld.elements[13] - avatarRig.object3D.matrixWorld.elements[13];

            var avatarHeightFrac = avatarHeight / avatarRig.object3D.scale.y;
            if (avatarRig.components["player-info"].data.original_scale == null) {
              //updateComponent("media-loader", { deskName: desks[i].object3D.name });
              console.log("test");
              var start_scale = Object.assign({}, avatarRig.object3D.scale);
              avatarRig.updateComponent("player-info", { original_scale: start_scale });
            }
            avatarRig.object3D.scale.set(
              args[0] / avatarHeightFrac - 0.3 / avatarHeightFrac,
              args[0] / avatarHeightFrac - 0.3 / avatarHeightFrac,
              args[0] / avatarHeightFrac - 0.3 / avatarHeightFrac
            );
            avatarRig.object3D.matrixNeedsUpdate = true;
          } else {
            this.addToPresenceLog({ type: "log", body: "Please enter a height within 1m - 2.5m" });
          }
          break;
        }
      // --------------------------------------------------------------------------------------------------------------------
      case "grow":
        for (let i = 0; i < scales.length; i++) {
          if (scales[i] > curScale.x) {
            avatarRig.object3D.scale.set(scales[i], scales[i], scales[i]);
            avatarRig.object3D.matrixNeedsUpdate = true;
            break;
          }
        }

        break;
      case "shrink":
        for (let i = scales.length - 1; i >= 0; i--) {
          if (curScale.x > scales[i]) {
            avatarRig.object3D.scale.set(scales[i], scales[i], scales[i]);
            avatarRig.object3D.matrixNeedsUpdate = true;
            break;
          }
        }

        break;
      case "leave":
        this.entryManager.exitScene();
        this.remountUI({ roomUnavailableReason: "left" });
        break;
      case "duck":
        spawnChatMessage(getAbsoluteHref(location.href, ducky));
        if (Math.random() < 0.01) {
          this.scene.systems["hubs-systems"].soundEffectsSystem.playSoundOneShot(SOUND_SPECIAL_QUACK);
        } else {
          this.scene.systems["hubs-systems"].soundEffectsSystem.playSoundOneShot(SOUND_QUACK);
        }
        break;
      case "debug":
        physicsSystem = document.querySelector("a-scene").systems["hubs-systems"].physicsSystem;
        physicsSystem.setDebug(!physicsSystem.debugEnabled);
        break;
      case "vrstats":
        document.getElementById("stats").components["stats-plus"].toggleVRStats();
        break;
      case "scene":
        if (args[0]) {
          if (await isValidSceneUrl(args[0])) {
            err = this.hubChannel.updateScene(args[0]);
            if (err === "unauthorized") {
              this.addToPresenceLog({ type: "log", body: "You do not have permission to change the scene." });
            }
          } else {
            this.addToPresenceLog({ type: "log", body: messages["invalid-scene-url"] });
          }
        } else if (this.hubChannel.canOrWillIfCreator("update_hub")) {
          this.mediaSearchStore.sourceNavigateWithNoNav("scenes", "use");
        }

        break;
      case "rename":
        err = this.hubChannel.rename(args.join(" "));
        if (err === "unauthorized") {
          this.addToPresenceLog({ type: "log", body: "You do not have permission to rename this room." });
        }
        break;
      case "capture":
        if (!captureSystem.available()) {
          this.log("Capture unavailable.");
          break;
        }
        if (args[0] === "stop") {
          if (captureSystem.started()) {
            captureSystem.stop();
            this.log("Capture stopped.");
          } else {
            this.log("Capture already stopped.");
          }
        } else {
          if (captureSystem.started()) {
            this.log("Capture already running.");
          } else {
            captureSystem.start();
            this.log("Capture started.");
          }
        }
        break;
      case "audiomode":
        {
          const shouldEnablePositionalAudio = window.APP.store.state.preferences.audioOutputMode === "audio";
          window.APP.store.update({
            preferences: { audioOutputMode: shouldEnablePositionalAudio ? "panner" : "audio" }
          });
          this.log(`Positional Audio ${shouldEnablePositionalAudio ? "enabled" : "disabled"}.`);
        }
        break;
    }
  };
}
