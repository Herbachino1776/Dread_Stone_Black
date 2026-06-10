import * as THREE from 'three';

function line(points, color, opacity = 0.82) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function ring(center, radius, color) {
  const points = [];
  for (let index = 0; index <= 56; index += 1) {
    const theta = (index / 56) * Math.PI * 2;
    points.push(new THREE.Vector3(center.x + Math.cos(theta) * radius, center.y, center.z + Math.sin(theta) * radius));
  }
  return line(points, color, 0.72);
}

function marker(position, color, size = 0.28) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, depthWrite: false }),
  );
  mesh.position.copy(position);
  return mesh;
}

function makeLabel(text, color = '#ffd28a') {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '22px sans-serif';
  context.fillStyle = 'rgba(0, 0, 0, 0.62)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.fillText(text, 10, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

export class TorchDebugRenderer {
  constructor({ runtime }) {
    this.runtime = runtime;
    this.group = new THREE.Group();
    this.group.name = `${runtime.locationId}-debug-torches`;
    this.group.userData = { locationId: runtime.locationId, devOnly: true, generatedBy: 'TorchDebugRenderer' };
    this.build();
  }

  build() {
    const warningIds = new Set((this.runtime.fixtureValidation?.warnings ?? []).map((warning) => warning.id).filter(Boolean));
    const errorIds = new Set((this.runtime.fixtureValidation?.errors ?? []).map((error) => error.id).filter(Boolean));

    (this.runtime.torchFixtures ?? []).forEach((fixture) => {
      const position = new THREE.Vector3(fixture.position.x, fixture.position.y, fixture.position.z);
      const normal = new THREE.Vector3(fixture.wallNormal.x, 0, fixture.wallNormal.z).normalize();
      const lightPosition = new THREE.Vector3(fixture.lightPosition.x, fixture.lightPosition.y, fixture.lightPosition.z);
      const statusColor = errorIds.has(fixture.id) ? 0xff2d2d : warningIds.has(fixture.id) ? 0xffd24d : 0x55ffaa;
      const fixtureGroup = new THREE.Group();
      fixtureGroup.name = `${fixture.id}-torch-debug`;
      fixtureGroup.userData = { torchFixtureId: fixture.id, roomId: fixture.roomId, devOnly: true };

      fixtureGroup.add(marker(position, statusColor, 0.24));
      fixtureGroup.add(marker(lightPosition, 0xffa45a, 0.18));
      fixtureGroup.add(line([position, position.clone().add(normal.multiplyScalar(0.95))], statusColor));
      fixtureGroup.add(ring(lightPosition.clone().setY(0.16), fixture.profile.distance ?? 8, statusColor));

      const label = makeLabel(`${fixture.id} / ${fixture.roomId}`, errorIds.has(fixture.id) ? '#ff8b8b' : warningIds.has(fixture.id) ? '#ffe08a' : '#a8ffd8');
      if (label) {
        label.position.copy(position).add(new THREE.Vector3(0, 0.55, 0));
        fixtureGroup.add(label);
      }

      this.group.add(fixtureGroup);
    });
  }
}
