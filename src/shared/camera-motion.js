import { MathUtils } from "three";

// Cosmetic damping never changes the viewpoint used for photographic evidence.
export function updateCameraPose(
  model,
  dt,
  {
    aim = false,
    moving = false,
    sprint = false,
    time = 0,
    shake = 1,
    shotAge = Infinity,
  } = {},
) {
  if (dt <= 0) return;
  const damp = (a, b) => MathUtils.damp(a, b, 12, dt);
  const blend = (model.userData.motionBlend = MathUtils.damp(
    model.userData.motionBlend || 0,
    moving ? 1 : 0,
    8,
    dt,
  ));
  const pace = sprint ? 9 : 6;
  const bob = Math.sin(time * pace) * 0.006 * blend * shake;
  const breath = Math.sin(time * 1.7) * 0.0015 * shake;
  const kick =
    shotAge >= 0 && shotAge < 0.28
      ? Math.sin((shotAge / 0.28) * Math.PI) * Math.exp(-shotAge * 10) * shake
      : 0;
  model.position.x = damp(model.position.x, (aim ? 0.2 : 0.28) + bob);
  model.position.y = damp(
    model.position.y,
    (aim ? -0.18 : -0.28) + Math.abs(bob) * 0.65 + breath,
  );
  model.position.z = damp(model.position.z, -0.53 + kick * 0.014);
  model.rotation.z = damp(model.rotation.z, -0.05 + bob * 0.9);
  model.rotation.x = damp(model.rotation.x, -0.13 - kick * 0.04);
}
