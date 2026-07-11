# Outdoor sky cycle

Participating outdoor scenes own one inward-facing sphere and one material. It samples the locked day, red, and night panoramas; normalized weights prevent blend pumping. Dawn and dusk share the red GPU texture, with dusk offset by π. UV rotation is seam-safe, wall-time based, and completes once per 20 real minutes so cloud movement remains slow but perceptible.

Textures remain sRGB, mipmapped, linearly filtered, clamp-to-edge, and at mild anisotropy. Title and indoor scenes do not instantiate the runtime.
