import * as THREE from 'three';

const NATIVE_COLOR = new THREE.Color(0x58c7ff);
const COMPATIBILITY_COLOR = new THREE.Color(0xffb45c);
const SELECTED_COLOR = new THREE.Color(0xf8f08a);

/** Development-only presentation of production progressive target records. */
export class CreatureLabSiteMarkerRenderer {
  constructor({ scene, targeting } = {}) {
    this.scene = scene;
    this.targeting = targeting;
    this.selectedSiteId = null;
    this.showSites = false;
    this.showSelectedRadius = false;
    this.disposed = false;
    this.markerGeometry = new THREE.SphereGeometry(0.018, 7, 5);
    this.markerMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false, toneMapped: false });
    const count = Math.max(1, targeting?.records?.length ?? 0);
    this.markers = new THREE.InstancedMesh(this.markerGeometry, this.markerMaterial, count);
    this.markers.name = 'CreatureLabProgressiveSiteMarkers';
    this.markers.count = 0;
    this.markers.frustumCulled = false;
    this.markers.renderOrder = 100;
    this.markers.userData.creatureLabPresentation = true;
    this.markers.raycast = () => {};
    this.radiusGeometry = new THREE.SphereGeometry(1, 10, 7);
    this.radiusMaterial = new THREE.MeshBasicMaterial({ color: SELECTED_COLOR, wireframe: true, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false });
    this.selectedRadius = new THREE.Mesh(this.radiusGeometry, this.radiusMaterial);
    this.selectedRadius.name = 'CreatureLabSelectedProgressiveSiteRadius';
    this.selectedRadius.renderOrder = 99;
    this.selectedRadius.frustumCulled = false;
    this.selectedRadius.userData.creatureLabPresentation = true;
    this.selectedRadius.raycast = () => {};
    this.scene?.add?.(this.markers, this.selectedRadius);
    this.update();
  }

  setSettings({ selectedSiteId = this.selectedSiteId, showSites = this.showSites, showSelectedRadius = this.showSelectedRadius } = {}) {
    this.selectedSiteId = selectedSiteId;
    this.showSites = showSites === true;
    this.showSelectedRadius = showSelectedRadius === true;
    this.update();
  }

  update() {
    if (this.disposed) return;
    const records = this.targeting?.listRecords?.({ refresh: true }) ?? [];
    let rendered = 0;
    const matrix = new THREE.Matrix4();
    const selected = records.find((record) => record.siteId === this.selectedSiteId) ?? null;
    records.forEach((record) => {
      if (!record?.currentWorldCenter || record.bindingMode === 'UNTARGETABLE' || rendered >= this.markers.instanceMatrix.count) return;
      matrix.makeTranslation(record.currentWorldCenter.x, record.currentWorldCenter.y, record.currentWorldCenter.z);
      this.markers.setMatrixAt(rendered, matrix);
      this.markers.setColorAt(rendered, record.siteId === this.selectedSiteId
        ? SELECTED_COLOR
        : record.authority === 'COMPATIBILITY' ? COMPATIBILITY_COLOR : NATIVE_COLOR);
      rendered += 1;
    });
    this.markers.count = rendered;
    this.markers.visible = this.showSites && rendered > 0;
    this.markers.instanceMatrix.needsUpdate = true;
    if (this.markers.instanceColor) this.markers.instanceColor.needsUpdate = true;
    const radius = Number(selected?.radiusWorld);
    this.selectedRadius.visible = this.showSites && this.showSelectedRadius && Boolean(selected?.currentWorldCenter) && radius > 0;
    if (this.selectedRadius.visible) {
      this.selectedRadius.position.copy(selected.currentWorldCenter);
      this.selectedRadius.scale.setScalar(radius);
      this.selectedRadius.updateMatrixWorld();
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.markers.removeFromParent();
    this.selectedRadius.removeFromParent();
    this.markerGeometry.dispose();
    this.markerMaterial.dispose();
    this.radiusGeometry.dispose();
    this.radiusMaterial.dispose();
    this.targeting = null;
    this.scene = null;
  }
}
