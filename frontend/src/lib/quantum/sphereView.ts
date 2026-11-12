/**
 * How a sphere is drawn on screen. The Bloch sphere and the Q-sphere share
 * this, so both turn the same way when dragged and line up the same way.
 *
 * Orthographic projection (a flat view with no perspective) of a unit sphere,
 * seen from height angle θ above the equator, turned by angle α around it:
 *   screen right = −sinα·x + cosα·y
 *   screen up    = −sinθ·(cosα·x + sinα·y) + cosθ·z
 * Everything drawn comes from these two angles, which is what keeps the axes,
 * the equator and the outline lined up: the equator becomes an ellipse with
 * half-widths R and |sinθ|·R (so the ±x/±y tips land exactly on it), and the
 * poles land at cosθ·R, just inside the outline, as they should.
 *
 * `right`, `up` and the view direction are three directions at right angles
 * to each other:
 *   view = right × up = (cosθ·cosα, cosθ·sinα, sinθ)
 * which points at the camera. So a point's dot product with `view` is its
 * depth, positive towards the viewer. That is what `depthOf` returns, and it
 * decides what is drawn behind the ball.
 */

export interface Camera {
	sinTilt: number;
	cosTilt: number;
	sinAz: number;
	cosAz: number;
}

export const DEFAULT_ELEVATION = Math.asin(0.35);
export const DEFAULT_AZIMUTH = (20 * Math.PI) / 180;
// Stop just before the poles: at exactly ±90° the turning angle stops meaning
// anything (the equator squashes into a line) and dragging feels stuck.
export const MAX_ELEVATION = (85 * Math.PI) / 180;

export function camera(elevation: number, azimuth: number): Camera {
	return {
		sinTilt: Math.sin(elevation),
		cosTilt: Math.cos(elevation),
		sinAz: Math.sin(azimuth),
		cosAz: Math.cos(azimuth)
	};
}

export function project(
	x: number,
	y: number,
	z: number,
	centre: number,
	radius: number,
	c: Camera
): { x: number; y: number } {
	const right = -c.sinAz * x + c.cosAz * y;
	const up = -c.sinTilt * (c.cosAz * x + c.sinAz * y) + c.cosTilt * z;
	return { x: centre + right * radius, y: centre - up * radius };
}

export function depthOf(x: number, y: number, z: number, c: Camera): number {
	return c.cosTilt * (c.cosAz * x + c.sinAz * y) + c.sinTilt * z;
}

// Half of an ellipse centred at (cx, cy), from its far left to its far right.
export function arcPath(cx: number, cy: number, rx: number, ry: number, sweep: number): string {
	return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 ${sweep} ${cx + rx} ${cy}`;
}

/**
 * A circle of latitude at height z (the equator is z = 0), split into the
 * half that faces the camera and the half behind the ball.
 *
 * On the circle (r·cos t, r·sin t, z) the projection is
 * (r·sin(t−α), −sinθ·r·cos(t−α) + cosθ·z), an ellipse with half-widths r and
 * |sinθ|·r around the projected point (0, 0, z). Its depth is
 * cosθ·r·cos(t−α) + sinθ·z, which is largest at t = α, the bottom of the
 * ellipse when the camera is above the equator. Away from the equator the
 * near half is not exactly half, but drawing it as the bottom (or top) half
 * is close, and a ring only guides the eye.
 */
export function latitudeArcs(
	z: number,
	centre: number,
	radius: number,
	c: Camera
): { z: number; near: string; far: string } {
	const r = Math.sqrt(Math.max(0, 1 - z * z));
	const mid = project(0, 0, z, centre, radius, c);
	const rx = r * radius;
	const ry = r * radius * Math.abs(c.sinTilt);
	const farSweep = c.sinTilt >= 0 ? 1 : 0;
	return {
		z,
		far: arcPath(mid.x, mid.y, rx, ry, farSweep),
		near: arcPath(mid.x, mid.y, rx, ry, 1 - farSweep)
	};
}
