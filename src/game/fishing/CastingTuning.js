export const CAST_GESTURE_HISTORY_MS = 180;
export const CAST_MIN_DRAG_DISTANCE = 34;
export const CAST_MIN_RELEASE_SPEED = 520;
export const CAST_MAX_RELEASE_SPEED = 1850;
export const CAST_POWER_FROM_VELOCITY = 0.012;
export const CAST_POWER_FROM_LOAD = 13;
export const CAST_SIDE_AIM_SCALE = 0.00042;
export const CAST_VERTICAL_ARC_SCALE = 0.00036;
export const CAST_ROD_SMOOTHING = 0.22;
export const CAST_ROD_BEND_SCALE = 1.15;
export const CAST_ROD_RETURN_SPEED = 7.5;
export const CAST_MAX_RANGE = 44;

// First-person Rod A1 rest pose. The factory authors the held rod with its
// handle-to-tip axis on local +Z after the view mesh yaw, while the camera looks
// into the scene on -Z. Keep the rest yaw flipped forward so the tip projects
// away from the player instead of back/up over the right shoulder.
export const ROD_REST_POS = Object.freeze({ x: 0.74, y: -0.5, z: -2.55 });
export const ROD_REST_ROT = Object.freeze({ x: 0.42, y: 3.3, z: 0.28 });
export const ROD_GRAB_SPRING = 24;
export const ROD_GRAB_DAMPING = 8.8;
export const ROD_ANGULAR_SPRING = 17;
export const ROD_ANGULAR_DAMPING = 6.4;
export const ROD_MASS_FEEL = 1.28;
export const ROD_BEND_RELEASE_SCALE = 0.42;
export const ROD_GRAB_HIT_RADIUS = 34;
export const ROD_RELEASE_SNAP_SCALE = 1.15;

export const LINE_POINT_COUNT = 18;
export const LINE_MIN_LENGTH = 1.2;
export const LINE_START_LENGTH = 2.0;
export const LINE_MAX_LENGTH = 38;
export const LINE_SEGMENT_ITERATIONS = 5;
export const LINE_GRAVITY = -14.5;
export const LINE_AIR_DRAG = 0.988;
export const LINE_WATER_DRAG = 0.9;
export const LINE_TENSION_STIFFNESS = 8.5;
export const LINE_TENSION_DAMPING = 0.42;
export const LINE_SPOOL_OUT_SPEED = 28;
export const LINE_AUTO_REEL_SPEED = 0.72;
export const LINE_REEL_PULL_BOOST = 0.7;
export const LINE_SLACK_OPACITY = 0.12;
export const LINE_TAUT_OPACITY = 0.48;
export const LURE_MASS = 0.42;
export const LURE_RADIUS = 0.08;
export const LURE_WATER_BOB_HEIGHT = 0.055;
export const LURE_WATER_BOB_SPEED = 4.2;
export const LURE_SURFACE_PULL_SCALE = 0.34;
export const LURE_HELICOPTER_TENSION_SCALE = 1.35;
export const LURE_MAX_SPEED = 32;
export const FISH_BITE_SETTLE_MIN_MS = 900;
export const FISH_BITE_SETTLE_MAX_MS = 1500;
