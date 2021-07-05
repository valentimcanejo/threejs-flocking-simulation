import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

var W = window.innerWidth;
var H = window.innerHeight;

var col = {
  black: 0x000000,
  grey: 0x111133,
  white: 0x333333,
};

var geom = {
  taper: new THREE.CylinderGeometry(0, 1, 1, 2),
};

var mat = {
  x_hull: new THREE.MeshStandardMaterial({ color: col.white }),
  o_hull: new THREE.MeshStandardMaterial({
    color: col.grey,
    shading: THREE.FlatShading,
  }),
  x_dec: new THREE.MeshStandardMaterial({ color: col.white }),
  o_dec: new THREE.MeshStandardMaterial({ color: col.white }),
  x_pit: new THREE.MeshStandardMaterial({ color: col.white }),
};

var scene, renderer, camera;
var boids = [];

setupRender();
setupLights();
setupFlock(200, 0);

function setupRender() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 1000);
  camera.position.set(0, 0, 250);
  camera.lookAt(scene.position);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(W, H);
  renderer.setClearColor(col.black);

  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
}

function setupLights() {
  var light_amb = new THREE.AmbientLight(0x999999, 1);

  var light_hem = new THREE.HemisphereLight(0xffffcc, 0x222200, 1);
  light_hem.position.setY(15);

  var light_dir = new THREE.DirectionalLight();

  scene.add(light_amb, light_hem, light_dir);
}

function setupFlock(numA, numB) {
  var i = 0;
  while (i < numA) {
    boids[i] = new Boid(1);
    i++;
  }

  while (i < numA + numB) {
    boids[i] = new Boid(0);
    i++;
  }
}

function XShip() {
  var nose = new THREE.Mesh(geom.taper, mat.x_hull);
  nose.position.set(0, 0, 2);
  nose.scale.set(1, 1, 1);

  var x_ship = new THREE.Group();
  x_ship.add(nose);
  x_ship.castShadow = true;
  this.mesh = x_ship;
}

function rrand(min, max) {
  return Math.random() * (max - min) + min;
}

function Boid(type) {
  this.type = type;

  this.position = type
    ? new THREE.Vector3(rrand(80, 100), rrand(-10, 10), 0)
    : new THREE.Vector3(rrand(-80, -100), rrand(-10, 10), 0);
  this.velocity = new THREE.Vector3(
    rrand(0.001, 0.001),
    rrand(-1, 1),
    rrand(-1, 1)
  );
  this.acceleration = new THREE.Vector3(0, 0, 0);
  this.mass = type ? 1 : 15;

  this.obj = new XShip();
  this.home = type ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(50, 0, 0);
  scene.add(this.obj.mesh);
}

Boid.prototype.step = function (flock) {
  this.accumulate(flock);
  this.update();
  this.obj.mesh.position.set(this.position.x, this.position.y, this.position.z);
};

Boid.prototype.accumulate = function (flock) {
  var separation, alignment, cohesion, centering;
  separation = this.separate(flock).multiplyScalar(0.015 * this.mass);
  alignment = this.align(flock).multiplyScalar(0.05);
  cohesion = this.cohesion(flock).multiplyScalar(0.01);
  centering = this.steer(this.home).multiplyScalar(0.0001);
  centering.multiplyScalar(this.position.distanceTo(this.home) * this.mass); // stronger centering if farther away
  this.acceleration.add(separation);
  this.acceleration.add(alignment);
  this.acceleration.add(cohesion);
  this.acceleration.add(centering);
  this.acceleration.divideScalar(this.mass);
};

Boid.prototype.update = function () {
  this.velocity.add(this.acceleration);
  this.position.add(this.velocity);
  this.acceleration.set(0, 0, 0);

  var pointAt = this.type ? this.position.clone() : this.velocity.clone();
  this.obj.mesh.lookAt(pointAt);
};

Boid.prototype.separate = function (flock) {
  var minRange = 40;
  var currBoid;
  var total = new THREE.Vector3(0, 0, 0);
  var count = 0;

  for (var i = 0; i < flock.length; i++) {
    currBoid = flock[i];
    var dist = this.position.distanceTo(currBoid.position);

    if (dist < minRange && dist > 0) {
      var force = this.position.clone();
      force.sub(currBoid.position);
      force.normalize();
      force.divideScalar(dist);
      total.add(force);
      count++;
    }
  }

  if (count > 0) {
    total.divideScalar(count);
    total.normalize();
  }
  return total;
};

Boid.prototype.align = function (flock) {
  var neighborRange = 50;
  var currBoid;
  var total = new THREE.Vector3(0, 0, 0);
  var count = 0;

  for (var i = 0; i < flock.length; i++) {
    currBoid = flock[i];
    var dist = this.position.distanceTo(currBoid.position);

    if (dist < neighborRange && dist > 0) {
      total.add(currBoid.velocity);
      count++;
    }
  }

  if (count > 0) {
    total.divideScalar(count);
    total.limit(1);
  }
  return total;
};

Boid.prototype.cohesion = function (flock) {
  var neighborRange = 10;
  var currBoid;
  var total = new THREE.Vector3(0, 0, 0);
  var count = 0;

  for (var i = 0; i < flock.length; i++) {
    currBoid = flock[i];
    var dist = this.position.distanceTo(currBoid.position);

    if (dist < neighborRange && dist > 0) {
      total.add(currBoid.position);
      count++;
    }
  }

  if (count > 0) {
    total.divideScalar(count);

    return this.steer(total);
  } else {
    return total;
  }
};

Boid.prototype.steer = function (target) {
  var steer = new THREE.Vector3(0, 0, 0);
  var des = new THREE.Vector3().subVectors(target, this.position);
  var dist = des.length();
  if (dist > 0) {
    des.normalize();
    steer.subVectors(des, this.velocity);
  }
  return steer;
};

THREE.Vector3.prototype.limit = function (max) {
  if (this.length() > max) {
    this.normalize();
    this.multiplyScalar(max);
  }
};

function render() {
  requestAnimationFrame(render);
  for (var i = 0; i < boids.length; i++) {
    boids[i].step(boids);
  }
  renderer.render(scene, camera);
}
render();
