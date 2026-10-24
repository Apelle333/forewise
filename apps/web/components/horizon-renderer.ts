import * as THREE from 'three';
import { horizonHistory, scenarioValue, type Direction } from '@/lib/horizon-data';

type Settings = { days: number; spread: number; direction: Direction; reduced: boolean };

export function mountHorizon(host: HTMLElement, initial: Settings, onLost: () => void) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  const group = new THREE.Group();
  scene.add(group);
  let settings = initial;
  let frame = 0;
  let disposed = false;
  let progress = 0;
  let pointerX = 0;
  let pointerY = 0;
  let rotationY = -0.24;
  let rotationX = 0;
  let storyProgress: number | null = null;
  let futurePhase = false;
  const disposable: (THREE.BufferGeometry | THREE.Material)[] = [];
  const mint =
    initial.direction === 'observatory'
      ? 0xb7b6ff
      : initial.direction === 'atlas'
        ? 0xe5b18a
        : 0x8cf1cf;
  const amber = 0xf5b577;

  function line(points: THREE.Vector3[], color: number, opacity: number, radius = 0) {
    const material = radius
      ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const geometry = radius
      ? new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points),
          points.length * 2,
          radius,
          5,
          false,
        )
      : new THREE.BufferGeometry().setFromPoints(points);
    disposable.push(material, geometry);
    const object = radius ? new THREE.Mesh(geometry, material) : new THREE.Line(geometry, material);
    object.userData.future = futurePhase;
    group.add(object);
  }

  function rebuild() {
    for (const resource of disposable) resource.dispose();
    disposable.length = 0;
    group.clear();
    if (settings.direction === 'observatory') {
      // A radial time study: angular position is time; radius is a scaled sample value.
      for (let ring = 1; ring <= 5; ring++) {
        line(
          Array.from({ length: 129 }, (_, i) => {
            const a = (i / 128) * Math.PI * 2;
            return new THREE.Vector3(Math.cos(a) * ring * 1.1, Math.sin(a) * ring * 1.1, 0);
          }),
          mint,
          0.12,
        );
      }
      for (let lane = -10; lane <= 10; lane++) {
        line(
          Array.from({ length: settings.days + 1 }, (_, i) => {
            const a = -Math.PI / 2 + (i / 28) * Math.PI * 1.7;
            const r = 3.4 + (scenarioValue(Math.max(1, i), lane / 10, settings.spread) - 161) / 35;
            return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, lane * 0.13);
          }),
          lane === 0 ? amber : mint,
          lane === 0 ? 1 : 0.5,
          lane === 0 ? 0.02 : 0,
        );
      }
      line([new THREE.Vector3(0, -6, 0), new THREE.Vector3(0, 6, 0)], amber, 0.35);
      line([new THREE.Vector3(-6, 0, 0), new THREE.Vector3(6, 0, 0)], mint, 0.2);
    } else {
      const history = horizonHistory.map(
        (v, i) => new THREE.Vector3(-8 + (i / 27) * 6, (v - 161) / 22, 0),
      );
      line(history, 0xe2f5ef, 1, 0.025);
      futurePhase = true;
      // The branching lines are explicit evenly spaced scenarios, not samples from a distribution.
      for (let lane = -16; lane <= 16; lane++) {
        const points = [new THREE.Vector3(-2, 0, 0)];
        for (let day = 1; day <= settings.days; day++) {
          const fraction = day / 28;
          const q = lane / 16;
          const depth =
            settings.direction === 'atlas' ? q * 4 : Math.sin(q * Math.PI) * fraction * 2.4;
          points.push(
            new THREE.Vector3(
              -2 + fraction * 10,
              (scenarioValue(day, q, settings.spread) - 161) / 22,
              depth,
            ),
          );
        }
        line(
          points,
          lane === 0 ? amber : mint,
          lane === 0 ? 1 : 0.38 + Math.abs(lane) / 60,
          lane === 0 ? 0.028 : 0.012,
        );
      }
      if (settings.direction === 'atlas') {
        for (let day = 1; day <= settings.days; day += 2) {
          line(
            Array.from(
              { length: 33 },
              (_, j) =>
                new THREE.Vector3(
                  -2 + (day / 28) * 10,
                  (scenarioValue(day, (j - 16) / 16, settings.spread) - 161) / 22,
                  (j - 16) / 4,
                ),
            ),
            mint,
            0.25,
          );
        }
      } else {
        // A translucent elliptic sleeve makes the scenario fan spatially legible.
        const vertices: number[] = [],
          indices: number[] = [];
        const segments = 48;
        for (let day = 0; day <= settings.days; day++) {
          for (let j = 0; j <= segments; j++) {
            const angle = (j / segments) * Math.PI * 2;
            vertices.push(
              -2 + (day / 28) * 10,
              day === 0 ? 0 : (scenarioValue(day, Math.cos(angle), settings.spread) - 161) / 22,
              ((Math.sin(angle) * day) / 28) * 2.4,
            );
            if (day < settings.days && j < segments) {
              const a = day * (segments + 1) + j,
                b = a + segments + 1;
              indices.push(a, b, a + 1, b, b + 1, a + 1);
            }
          }
        }
        const skin = new THREE.BufferGeometry();
        skin.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        skin.setIndex(indices);
        const skinMaterial = new THREE.MeshBasicMaterial({
          color: mint,
          transparent: true,
          opacity: 0.045,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        group.add(new THREE.Mesh(skin, skinMaterial));
        group.children.at(-1)!.userData.future = true;
        disposable.push(skin, skinMaterial);
        for (const day of [7, 14, 21, 28].filter((d) => d <= settings.days)) {
          const t = day / 28;
          line(
            Array.from({ length: 65 }, (_, i) => {
              const a = (i / 64) * Math.PI * 2;
              return new THREE.Vector3(
                -2 + t * 10,
                (scenarioValue(day, Math.cos(a), settings.spread) - 161) / 22,
                Math.sin(a) * t * 2.4,
              );
            }),
            mint,
            0.5,
          );
          group.children.at(-1)!.userData.revealAfter = day / 28;
        }
      }
      futurePhase = false;
      for (let x = -10; x <= 10; x += 2)
        line([new THREE.Vector3(x, -4, -5), new THREE.Vector3(x, -4, 5)], mint, 0.08);
      for (let z = -5; z <= 5; z++)
        line([new THREE.Vector3(-10, -4, z), new THREE.Vector3(10, -4, z)], mint, 0.08);
      line([new THREE.Vector3(-2, -4, 0), new THREE.Vector3(-2, 3, 0)], amber, 0.3);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 12, 8),
        new THREE.MeshBasicMaterial({ color: amber }),
      );
      dot.position.set(-2, 0, 0);
      disposable.push(dot.geometry, dot.material);
      group.add(dot);
      for (let i = 0; i < history.length; i += 3) {
        const point = new THREE.Mesh(
          new THREE.SphereGeometry(0.038, 6, 5),
          new THREE.MeshBasicMaterial({ color: 0xe2f5ef }),
        );
        point.position.copy(history[i]);
        disposable.push(point.geometry, point.material);
        group.add(point);
      }
    }
    request();
  }

  function draw() {
    frame = 0;
    const rect = host.getBoundingClientRect();
    if (
      disposed ||
      document.hidden ||
      !rect.width ||
      !rect.height ||
      rect.bottom <= 0 ||
      rect.top >= innerHeight
    )
      return;
    const radial = settings.direction === 'observatory';
    camera.position.set(radial ? 0 : 1, radial ? 1 : 5.2, innerWidth < 600 ? 29 : 20);
    camera.lookAt(radial ? 0 : 0.5, -0.2, 0);
    const targetX = settings.reduced ? 0 : pointerY * 0.05;
    const targetY =
      storyProgress !== null
        ? -0.5 + storyProgress * 0.7
        : radial
          ? -0.16
          : -0.24 + (settings.reduced ? 0 : pointerX * 0.12 + progress * 0.28);
    rotationX += (targetX - rotationX) * 0.12;
    rotationY += (targetY - rotationY) * 0.12;
    group.rotation.set(rotationX, rotationY, radial ? 0 : 0.08);
    if (storyProgress !== null) {
      const reveal = Math.min(1, storyProgress * 1.7);
      group.scale.z = 0.08 + storyProgress * 0.92;
      for (const child of group.children) {
        if (!child.userData.future) continue;
        if (child.userData.revealAfter) {
          child.visible = reveal >= child.userData.revealAfter;
          continue;
        }
        const geometry = (child as THREE.Mesh).geometry;
        const count = geometry.index?.count ?? geometry.getAttribute('position').count;
        geometry.setDrawRange(0, Math.floor((count * reveal) / 3) * 3);
      }
    }
    renderer.render(scene, camera);
    renderer.domElement.dataset.rendered = 'true';
    if (Math.abs(rotationX - targetX) + Math.abs(rotationY - targetY) > 0.0002) request();
  }
  function request() {
    if (!frame && !disposed) frame = requestAnimationFrame(draw);
  }
  const resize = new ResizeObserver(() => {
    if (!host.clientWidth || !host.clientHeight) return;
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    request();
  });
  resize.observe(host);
  const intersection = new IntersectionObserver(request);
  intersection.observe(host);
  function move(event: PointerEvent) {
    if (event.pointerType === 'touch' || settings.reduced) return;
    const rect = host.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    request();
  }
  function scroll() {
    progress = Math.max(0, Math.min(1, window.scrollY / window.innerHeight));
    request();
  }
  function lost(event: Event) {
    event.preventDefault();
    onLost();
  }
  host.addEventListener('pointermove', move);
  window.addEventListener('scroll', scroll, { passive: true });
  document.addEventListener('visibilitychange', request);
  renderer.domElement.addEventListener('webglcontextlost', lost);
  rebuild();
  return {
    setStoryProgress(value: number) {
      storyProgress = value;
      request();
    },
    update(next: Settings) {
      settings = next;
      rebuild();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      host.removeEventListener('pointermove', move);
      window.removeEventListener('scroll', scroll);
      document.removeEventListener('visibilitychange', request);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      for (const resource of disposable) resource.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
