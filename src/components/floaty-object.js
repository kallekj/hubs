/* global AFRAME */
const COLLISION_LAYERS = require("../constants").COLLISION_LAYERS;
AFRAME.registerComponent("floaty-object", {
  schema: {
    // Make the object locked/kinematic upon load
    autoLockOnLoad: { default: false },

    // Make the object kinematic immediately upon release
    autoLockOnRelease: { default: false },

    // On release, modify the gravity based upon gravitySpeedLimit. If less than this, let the object float
    // otherwise apply releaseGravity.
    modifyGravityOnRelease: { default: false },

    // Gravity to apply if object is thrown at a speed greated than speed limit.
    releaseGravity: { default: -2 },

    // If true, the degree to which angular rotation is allowed when floating is reduced (useful for 2d media)
    reduceAngularFloat: { default: false },

    // Velocity speed limit under which gravity will not be added if modifyGravityOnRelease is true
    gravitySpeedLimit: { default: 0 } // Set to 0 to never apply gravity
  },

  init() {
    this.onGrab = this.onGrab.bind(this);
    this.onRelease = this.onRelease.bind(this);
    this.media_loaders = AFRAME.scenes[0].querySelectorAll("[media-loader]");
    this.coloredObjects = [];
    this.snapobjects = [];
    this.currentTick = 0;
    this.currentSnapTarget = 0;
    var i = 0;
    for (i = 0; i < this.media_loaders.length; i++) {
      // If the object to snap onto has a 3D object
      if (this.media_loaders[i].object3D != null) {
        // Check if object is of the desired type
        if (this.media_loaders[i].object3D.name.substring(0, 10).toLowerCase() == "snapobject") {
          this.snapobjects.push(this.media_loaders[i]);
        }
      }
    }
  },
  // ----------------------- CUSTOM CODE --------------------------
  snap(toSnap, snapOn) {
    // Align rotation
    toSnap.el.object3D.setRotationFromQuaternion(snapOn.object3D.getWorldQuaternion()); //.rotation.copy(snapOn.object3D.);
    // Align position
    toSnap.el.object3D.position.copy(snapOn.object3D.getWorldPosition());
    // Set to same scale
    toSnap.el.object3D.scale.copy(snapOn.object3D.getWorldScale());
    // Move slightly to avoid texture tearing
    toSnap.el.object3D.translateZ(0.002);
  },
  // --------------------------------------------------------------
  tick() {
    if (!this.bodyHelper) {
      this.bodyHelper = this.el.components["body-helper"];
    }

    const interaction = AFRAME.scenes[0].systems.interaction;
    const isHeld = interaction && interaction.isHeld(this.el);

    // ----------------------Custom Code for highlighting snapping object where video will be snapped---------------
    this.currentTick = this.currentTick + 1;
    // Every 15th tick check if video object is nearby snap-object
    if (this.currentTick % 15 == 0) {
      // Check if floaty object is currently held by user and that it is of type media-video
      if (isHeld && this.el.getAttribute("media-video") != null) {
        // Check that there are any snap-objects in the environment
        if (this.snapobjects.length > 0) {
          // Get the media object, not necessary since it's just "this.el"
          var mediaObject = this.el;
          // Go through the snap-objects to find the closest
          var closestObject = this.snapobjects[0];
          for (let snapobject of this.snapobjects) {
            if (
              mediaObject.object3D.getWorldPosition().distanceTo(snapobject.object3D.getWorldPosition()) <
              mediaObject.object3D.getWorldPosition().distanceTo(closestObject.object3D.getWorldPosition())
            ) {
              closestObject = snapobject;
            }
          }
          // A multiplier depending on the size of the snap-object for better snapping range
          const scaleMultiplier = (closestObject.object3D.scale.x * closestObject.object3D.scale.y) / 2;
          // Check if close enough to snap
          if (
            this.el.object3D.getWorldPosition().distanceTo(closestObject.object3D.getWorldPosition()) <
            0.4 + scaleMultiplier * 0.2
          ) {
            // Check if closest object already is colored
            if (this.coloredObjects.indexOf(closestObject) < 0) {
              // If not, empty list of colored objects, since there should be only one colored object
              if (this.coloredObjects.length > 0) {
                for (let oldObject of this.coloredObjects) {
                  oldObject.object3DMap.mesh.material.opacity = 1;
                  this.coloredObjects.splice(this.coloredObjects.indexOf(oldObject, 1));
                }
              }
              // Mark closest object by changing its opacity
              closestObject.object3DMap.mesh.material.opacity = 0.5;
              this.coloredObjects.push(closestObject);
            }
          } else {
            // If no object is close enough, then set objects to normal opacity
            for (let coloredObject of this.coloredObjects) {
              coloredObject.object3DMap.mesh.material.opacity = 1;
              this.coloredObjects.splice(this.coloredObjects.indexOf(coloredObject, 1));
            }
          }
        }
      }
    }
    if (this.currentTick > 1000000) {
      this.currentTick = 0;
    }
    // ---------------------------------------------------------------------------------------------------------------
    if (isHeld && !this.wasHeld) {
      this.onGrab();
    }

    if (this.wasHeld && !isHeld) {
      //------------------------------- Custom code for snapping videos--------------------------
      // Check that the object is a video loader.
      if (this.el.getAttribute("media-video") != null) {
        // Load the objects which can be snapped on
        media_loaders = AFRAME.scenes[0].querySelectorAll("[media-loader]");
        var snapobjects = [];
        var i = 0;
        for (i = 0; i < media_loaders.length; i++) {
          // If the object to snap onto has a 3D object
          if (media_loaders[i].object3D != null) {
            // Check if object is of the desired type
            if (media_loaders[i].object3D.name.substring(0, 10).toLowerCase() == "snapobject") {
              snapobjects.push(media_loaders[i]);
            }
          }
        }
        // Check if there are any snap objects in the scene
        if (snapobjects.length > 0) {
          var mediaObject = this.el;
          // Sort list of snap objects by distance to media objects
          var sortedSnapObjects = snapobjects.sort(function(a, b) {
            return (
              mediaObject.object3D.getWorldPosition().distanceTo(a.object3D.getWorldPosition()) -
              mediaObject.object3D.getWorldPosition().distanceTo(b.object3D.getWorldPosition())
            );
          });
          // A multiplier depending on the size of the snap-object for better snapping range
          const scaleMultiplier = (sortedSnapObjects[0].object3D.scale.x * sortedSnapObjects[0].object3D.scale.y) / 2;
          // If the closest object is close enough
          if (
            this.el.object3D.getWorldPosition().distanceTo(sortedSnapObjects[0].object3D.getWorldPosition()) <
            0.4 + scaleMultiplier * 0.2
          ) {
            // Snap onto it
            this.snap(this, sortedSnapObjects[0]);
            // Set the opacity of all snap objects to normal
            for (let coloredObject of this.coloredObjects) {
              coloredObject.object3DMap.mesh.material.opacity = 1;
              this.coloredObjects.splice(this.coloredObjects.indexOf(coloredObject, 1));
            }
          }
        }
      }
      this.onRelease();
      //------------------------------------------------------------------------------------------
    }

    if (!isHeld && this._makeStaticWhenAtRest) {
      const physicsSystem = this.el.sceneEl.systems["hubs-systems"].physicsSystem;
      const isMine = this.el.components.networked && NAF.utils.isMine(this.el);
      const linearThreshold = this.bodyHelper.data.linearSleepingThreshold;
      const angularThreshold = this.bodyHelper.data.angularSleepingThreshold;
      const uuid = this.bodyHelper.uuid;
      const isAtRest =
        physicsSystem.bodyInitialized(uuid) &&
        physicsSystem.getLinearVelocity(uuid) < linearThreshold &&
        physicsSystem.getAngularVelocity(uuid) < angularThreshold;

      if (isAtRest && isMine) {
        this.el.setAttribute("body-helper", { type: "kinematic" });
      }

      if (isAtRest || !isMine) {
        this._makeStaticWhenAtRest = false;
      }
    }

    this.wasHeld = isHeld;
  },

  play() {
    // We do this in play instead of in init because otherwise NAF.utils.isMine fails
    if (this.hasBeenHereBefore) return;
    this.hasBeenHereBefore = true;
    if (this.data.autoLockOnLoad) {
      this.el.setAttribute("body-helper", {
        gravity: { x: 0, y: 0, z: 0 }
      });
      this.setLocked(true);
    }
  },

  setLocked(locked) {
    if (this.el.components.networked && !NAF.utils.isMine(this.el)) return;

    this.locked = locked;
    this.el.setAttribute("body-helper", { type: locked ? "kinematic" : "dynamic" });
  },

  onRelease() {
    if (this.data.modifyGravityOnRelease) {
      const uuid = this.bodyHelper.uuid;
      const physicsSystem = this.el.sceneEl.systems["hubs-systems"].physicsSystem;
      if (
        this.data.gravitySpeedLimit === 0 ||
        (physicsSystem.bodyInitialized(uuid) && physicsSystem.getLinearVelocity(uuid) < this.data.gravitySpeedLimit)
      ) {
        this.el.setAttribute("body-helper", {
          gravity: { x: 0, y: 0, z: 0 },
          angularDamping: this.data.reduceAngularFloat ? 0.98 : 0.5,
          linearDamping: 0.95,
          linearSleepingThreshold: 0.1,
          angularSleepingThreshold: 0.1,
          collisionFilterMask: COLLISION_LAYERS.HANDS
        });

        this._makeStaticWhenAtRest = true;
      } else {
        this.el.setAttribute("body-helper", {
          gravity: { x: 0, y: this.data.releaseGravity, z: 0 },
          angularDamping: 0.01,
          linearDamping: 0.01,
          linearSleepingThreshold: 1.6,
          angularSleepingThreshold: 2.5,
          collisionFilterMask: COLLISION_LAYERS.DEFAULT_INTERACTABLE
        });
      }
    } else {
      this.el.setAttribute("body-helper", {
        collisionFilterMask: COLLISION_LAYERS.DEFAULT_INTERACTABLE,
        gravity: { x: 0, y: -9.8, z: 0 }
      });
    }

    if (this.data.autoLockOnRelease) {
      this.setLocked(true);
    }
  },

  onGrab() {
    this.el.setAttribute("body-helper", {
      gravity: { x: 0, y: 0, z: 0 },
      collisionFilterMask: COLLISION_LAYERS.HANDS
    });
    this.setLocked(false);
  },

  remove() {
    if (this.stuckTo) {
      const stuckTo = this.stuckTo;
      delete this.stuckTo;
      stuckTo._unstickObject();
    }
  }
});
