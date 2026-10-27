import * as THREE from 'three';
import { horizonHistory, scenarioValue, type Direction } from '@/lib/horizon-data';
import {
  easePose,
  illustrativeValue,
  inspectHorizon,
  motionTime,
  orbitAt,
  particleAt,
} from '@/lib/horizon-motion';

export type HorizonSettings = {
  days: number;
  spread: number;
  direction: Direction;
  reduced: boolean;
  cursor?: number;
  rangeVisible?: boolean;
  playing?: boolean;
  replay?: number;
};
type Settings = HorizonSettings;

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
  let fromX = 0,
    fromY = -0.24,
    targetX = 0,
    targetY = -0.24;
  let transitionAt = performance.now();
  let clock: { offset: number; startedAt: number | null } = { offset: 0, startedAt: null };
  let lastRender = 0;
  let cursorLine: THREE.Line;
  let cursorDot: THREE.Mesh;
  let particles: THREE.Points;
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
        group.children.at(-1)!.userData.range = lane !== 0;
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
        group.children.at(-1)!.userData.range = lane !== 0;
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
          group.children.at(-1)!.userData.range = true;
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
        group.children.at(-1)!.userData.range = true;
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
          group.children.at(-1)!.userData.range = true;
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
    const cursorGeometry = new THREE.BufferGeometry();
    cursorGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(6), 3),
    );
    const cursorMaterial = new THREE.LineBasicMaterial({
      color: 0xe2f5ef,
      transparent: true,
      opacity: 0.35,
    });
    cursorLine = new THREE.Line(cursorGeometry, cursorMaterial);
    cursorLine.frustumCulled = false;
    const dotGeometry = new THREE.SphereGeometry(0.075, 12, 8);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xe2f5ef });
    cursorDot = new THREE.Mesh(dotGeometry, dotMaterial);
    group.add(cursorLine, cursorDot);
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(32 * 3), 3),
    );
    particleGeometry.setAttribute(
      'opacity',
      new THREE.Float32BufferAttribute(new Float32Array(32), 1),
    );
    const particleMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { tint: { value: new THREE.Color(mint) } },
      vertexShader:
        'attribute float opacity; varying float fade; void main(){fade=opacity; vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p; gl_PointSize=3.5;}',
      fragmentShader:
        'uniform vec3 tint; varying float fade; void main(){float r=length(gl_PointCoord-vec2(0.5))*2.0; gl_FragColor=vec4(tint,fade*(1.0-smoothstep(0.0,1.0,r)));}',
    });
    particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.frustumCulled = false;
    group.add(particles);
    disposable.push(
      cursorGeometry,
      cursorMaterial,
      dotGeometry,
      dotMaterial,
      particleGeometry,
      particleMaterial,
    );
    retarget();
    request();
  }

  function visible() {
    const rect = host.getBoundingClientRect();
    return !!rect.width && !!rect.height && rect.bottom > 0 && rect.top < innerHeight;
  }
  function syncClock() {
    const now = performance.now();
    clock = {
      offset: motionTime(clock, now),
      startedAt:
        settings.playing && !settings.reduced && !document.hidden && visible() ? now : null,
    };
    renderer.domElement.dataset.playing = String(clock.startedAt !== null);
    renderer.domElement.dataset.motionTime = clock.offset.toFixed(3);
  }
  function retarget() {
    const now = performance.now();
    fromX = easePose(fromX, targetX, now - transitionAt);
    fromY = easePose(fromY, targetY, now - transitionAt);
    targetX = settings.reduced ? 0 : pointerY * 0.05;
    targetY =
      storyProgress !== null
        ? -0.5 + storyProgress * 0.7
        : settings.direction === 'observatory'
          ? -0.16
          : -0.24 + (settings.reduced ? 0 : pointerX * 0.12 + progress * 0.28);
    transitionAt = settings.reduced ? now - 360 : now;
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
    const now = performance.now();
    const running = clock.startedAt !== null;
    if (running && now - lastRender < 32) {
      request();
      return;
    }
    lastRender = now;
    const time = motionTime(clock, now);
    const radial = settings.direction === 'observatory';
    camera.position.set(radial ? 0 : 1, radial ? 1 : 5.2, innerWidth < 600 ? 29 : 20);
    camera.lookAt(radial ? 0 : 0.5, -0.2, 0);
    const orbit = orbitAt(time, settings.reduced || storyProgress !== null);
    group.rotation.set(
      easePose(fromX, targetX, now - transitionAt) + orbit.x,
      easePose(fromY, targetY, now - transitionAt) + orbit.y,
      radial ? 0 : 0.08,
    );
    const point = inspectHorizon(settings.cursor ?? 0, settings.days, settings.spread);
    const cx = point.day <= 0 ? -8 + ((point.day + 27) / 27) * 6 : -2 + (point.day / 28) * 10;
    const cy = (point.value - 161) / 22;
    const marker = cursorLine.geometry.getAttribute('position');
    marker.setXYZ(0, cx, -4, 0);
    marker.setXYZ(1, cx, cy, 0);
    marker.needsUpdate = true;
    cursorDot.position.set(cx, cy, 0);
    cursorLine.visible = cursorDot.visible = !radial && storyProgress === null;
    for (const child of group.children)
      if (child.userData.range) child.visible = settings.rangeVisible !== false;
    particles.visible = !settings.reduced && !radial && storyProgress === null;
    const positions = particles.geometry.getAttribute('position'),
      opacity = particles.geometry.getAttribute('opacity');
    for (let i = 0; i < 32; i++) {
      const p = particleAt(i, time),
        day = p.phase * settings.days;
      positions.setXYZ(
        i,
        -2 + (day / 28) * 10,
        (illustrativeValue(day, 0, settings.spread) - 161) / 22,
        p.lane * 0.12,
      );
      opacity.setX(i, p.alpha * 0.65);
    }
    positions.needsUpdate = opacity.needsUpdate = true;
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
    renderer.domElement.dataset.motionTime = time.toFixed(3);
    renderer.domElement.dataset.playing = String(running);
    if (
      running ||
      (now - transitionAt < 360 && Math.abs(fromX - targetX) + Math.abs(fromY - targetY) > 0.0002)
    )
      request();
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
  const intersection = new IntersectionObserver(() => {
    syncClock();
    request();
  });
  intersection.observe(host);
  function move(event: PointerEvent) {
    if (event.pointerType === 'touch' || settings.reduced) return;
    const rect = host.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    retarget();
    request();
  }
  function scroll() {
    progress = Math.max(0, Math.min(1, window.scrollY / window.innerHeight));
    retarget();
    syncClock();
    request();
  }
  function lost(event: Event) {
    event.preventDefault();
    onLost();
  }
  function visibility() {
    syncClock();
    request();
  }
  host.addEventListener('pointermove', move);
  window.addEventListener('scroll', scroll, { passive: true });
  document.addEventListener('visibilitychange', visibility);
  renderer.domElement.addEventListener('webglcontextlost', lost);
  rebuild();
  return {
    setStoryProgress(value: number) {
      storyProgress = value;
      retarget();
      request();
    },
    update(next: Settings) {
      syncClock();
      if (next.replay !== settings.replay) clock = { offset: 0, startedAt: null };
      const geometryChanged =
        settings.days !== next.days ||
        settings.spread !== next.spread ||
        settings.direction !== next.direction;
      settings = next;
      syncClock();
      if (geometryChanged) rebuild();
      else {
        retarget();
        request();
      }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      host.removeEventListener('pointermove', move);
      window.removeEventListener('scroll', scroll);
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      for (const resource of disposable) resource.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
