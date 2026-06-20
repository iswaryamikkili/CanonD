import * as THREE from 'three';
import { whiteKeyNames, blackKeyNames } from './piano/KeyMap.js';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import { velocity } from 'three/tsl';


const noteSemitoneOffsets = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11
};

const WHITE_KEY_COLOR = 0xc41e3a;
const BLACK_KEY_COLOR = 0xff6b00;
const FLASH_COLOR = 0xffff00;


function noteNameToMidiNumber(noteName) {
  const match = noteName.match(/^([A-G]#?)(\d+)$/);
  const letter = match[1];
  const octave = parseInt(match[2]);
  const semitone = noteSemitoneOffsets[letter];
  return (octave + 1) * 12 + semitone;
}


const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(10, 15, 12);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

const synth = new Tone.Synth().toDestination();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();


const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);


const keyLight = new THREE.DirectionalLight(0xffffff, 2);
keyLight.position.set(0, 12, 6);
scene.add(keyLight);


const rimLight = new THREE.DirectionalLight(0x4488ff, 1.5);
rimLight.position.set(0, -5, -8);
scene.add(rimLight);
const piano = new THREE.Group();
scene.add(piano);

const keysByMidiNumber = new Map();

const markerMaterial = new THREE.MeshBasicMaterial({
  color: 0x00aaff,
  transparent: true,
  opacity: 0.85
});

const activeMarkers = [];

function createMarkerGeometry(angle, radius) {
  const markerLength = 0.25; 
  const markerWidth = 0.3;   

  const angleHalf = markerLength / radius / 2; 

  const innerR = radius - markerWidth / 2;
  const outerR = radius + markerWidth / 2;

  const p1 = [innerR * Math.cos(angle - angleHalf), innerR * Math.sin(angle - angleHalf)];
  const p2 = [outerR * Math.cos(angle - angleHalf), outerR * Math.sin(angle - angleHalf)];
  const p3 = [outerR * Math.cos(angle + angleHalf), outerR * Math.sin(angle + angleHalf)];
  const p4 = [innerR * Math.cos(angle + angleHalf), innerR * Math.sin(angle + angleHalf)];

  const shape = new THREE.Shape();
  shape.moveTo(p1[0], p1[1]);
  shape.lineTo(p2[0], p2[1]);
  shape.lineTo(p3[0], p3[1]);
  shape.lineTo(p4[0], p4[1]);
  shape.lineTo(p1[0], p1[1]);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.1,
    bevelEnabled: false
  });
  geometry.rotateX(-Math.PI / 2);

  return geometry;
}

const whiteMaterial = new THREE.MeshPhysicalMaterial({
  color: WHITE_KEY_COLOR,
  roughness: 0.15,
  clearcoat: 1,
  clearcoatRoughness: 0.1
});

const blackMaterial = new THREE.MeshPhysicalMaterial({
  color: BLACK_KEY_COLOR,
  roughness: 0.15,
  clearcoat: 1,
  metalness:0.1,
  clearcoatRoughness: 0.1,
  
});


const totalWhiteKeys = 52;
const rInnerWhite = 2.4;
const rOuterWhite = 3.2;
const whiteGap = 0.008;

for (let i = 0; i < totalWhiteKeys; i++) {
  const angleStart = (i / totalWhiteKeys) * Math.PI * 2 + whiteGap;
  const angleEnd = ((i + 1) / totalWhiteKeys) * Math.PI * 2 - whiteGap;

  const p1 = [rInnerWhite * Math.cos(angleStart), rInnerWhite * Math.sin(angleStart)];
  const p2 = [rOuterWhite * Math.cos(angleStart), rOuterWhite * Math.sin(angleStart)];
  const p3 = [rOuterWhite * Math.cos(angleEnd), rOuterWhite * Math.sin(angleEnd)];
  const p4 = [rInnerWhite * Math.cos(angleEnd), rInnerWhite * Math.sin(angleEnd)];

  const shape = new THREE.Shape();
  shape.moveTo(p1[0], p1[1]);
  shape.lineTo(p2[0], p2[1]);
  shape.lineTo(p3[0], p3[1]);
  shape.lineTo(p4[0], p4[1]);
  shape.lineTo(p1[0], p1[1]);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.3,
    bevelEnabled: false
  });
  geometry.rotateX(-Math.PI / 2);

  const key = new THREE.Mesh(geometry, whiteMaterial.clone());
  key.userData.note = whiteKeyNames[i];
  key.userData.angle = (angleStart + angleEnd) / 2;
  key.userData.radius=(rInnerWhite+rOuterWhite)/2;
  piano.add(key);

  const midiNumber = noteNameToMidiNumber(whiteKeyNames[i]);
  keysByMidiNumber.set(midiNumber, key);
}


const blackPattern = [1/7, 2/7, 4/7, 5/7, 6/7];
const rInnerBlack = 0.8;
const rOuterBlack = 1.65;
const blackGap = 0.015;
const allBlackAngles = [];

for (let oct = 0; oct < 7; oct++) {
  blackPattern.forEach((fraction) => {
    const position = (oct + fraction) / (52 / 7);
    allBlackAngles.push(position * Math.PI * 2);
  });
}

const extraPosition = (7 + 1/7) / (52 / 7);
allBlackAngles.push(extraPosition * Math.PI * 2);

const sliceAngle = (Math.PI * 2) / 56;

allBlackAngles.forEach((angleMid, index) => {
  const angleStart = angleMid - sliceAngle / 2 + blackGap;
  const angleEnd = angleMid + sliceAngle / 2 - blackGap;

  const p1 = [rInnerBlack * Math.cos(angleStart), rInnerBlack * Math.sin(angleStart)];
  const p2 = [rOuterBlack * Math.cos(angleStart), rOuterBlack * Math.sin(angleStart)];
  const p3 = [rOuterBlack * Math.cos(angleEnd), rOuterBlack * Math.sin(angleEnd)];
  const p4 = [rInnerBlack * Math.cos(angleEnd), rInnerBlack * Math.sin(angleEnd)];

  const shape = new THREE.Shape();
  shape.moveTo(p1[0], p1[1]);
  shape.lineTo(p2[0], p2[1]);
  shape.lineTo(p3[0], p3[1]);
  shape.lineTo(p4[0], p4[1]);
  shape.lineTo(p1[0], p1[1]);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.2,
    bevelEnabled: false
  });
  geometry.rotateX(-Math.PI / 2);

  const key = new THREE.Mesh(geometry, blackMaterial.clone());
  key.userData.note = blackKeyNames[index];
  key.userData.angle = angleMid;
  key.userData.radius=(rInnerBlack+rOuterBlack)/2;
  piano.add(key);

  const midiNumber = noteNameToMidiNumber(blackKeyNames[index]);
  keysByMidiNumber.set(midiNumber, key);
});

function showMarkerOnKey(key) {

  const angle = key.userData.angle;
  const startRadius = key.userData.radius;

  const geometry = createMarkerGeometry(angle, startRadius);

  const marker = new THREE.Mesh(geometry, markerMaterial.clone());

  marker.position.y = 0.8;

  scene.add(marker);

  activeMarkers.push({
    mesh: marker,
    age: 0,
    life: 0.4,
    velocityY: 0.03
  });
}


function playAndAnimateNote(midiNumber, duration) {
  const key = keysByMidiNumber.get(midiNumber);
  if (!key) return;

  const noteName = key.userData.note;
  synth.triggerAttackRelease(noteName, duration);
  showMarkerOnKey(key);
  

  const isWhite = !noteName.includes('#');
  const defaultColor = isWhite ? WHITE_KEY_COLOR : BLACK_KEY_COLOR;

  key.material.color.set(FLASH_COLOR);

  setTimeout(() => {
    key.material.color.set(defaultColor);
  }, 400);
}



function scheduleMidiPlayback(midi) {
  Tone.Transport.stop();
  Tone.Transport.cancel();

  const allNotes = midi.tracks[0].notes;

  allNotes.forEach((note) => {
    Tone.Transport.schedule(() => {
      playAndAnimateNote(note.midi, note.duration);
    }, note.time);
  });

  Tone.Transport.start();
}

function parseMidi(arrayBuffer) {
  const midi = new Midi(arrayBuffer);
  scheduleMidiPlayback(midi);
}


const midiInput = document.getElementById('midi-upload');

midiInput.addEventListener('change', async (event) => {
  await Tone.start();

  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    parseMidi(e.target.result);
  };
  reader.readAsArrayBuffer(file);
});


window.addEventListener('click', async (event) => {
  await Tone.start();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(piano.children);

  if (intersects.length > 0) {
    const clickedKey = intersects[0].object;
    showMarkerOnKey(clickedKey);
    const noteName = clickedKey.userData.note;
    const isWhite = !noteName.includes('#');
    const defaultColor = isWhite ? WHITE_KEY_COLOR : BLACK_KEY_COLOR;

    clickedKey.material.color.set(FLASH_COLOR);
    setTimeout(() => {
      clickedKey.material.color.set(defaultColor);
    }, 200);

    synth.triggerAttackRelease(noteName, "8n");
  }
});


function animate() {

  requestAnimationFrame(animate);

  for (let i = activeMarkers.length - 1; i >= 0; i--) {

    const marker = activeMarkers[i];
  
    marker.age += 0.016;
  
    marker.mesh.material.opacity = 1 - marker.age / marker.life;
    marker.mesh.position.y += marker.velocityY;
  
    if (marker.age >= marker.life) {
      scene.remove(marker.mesh);
      activeMarkers.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
