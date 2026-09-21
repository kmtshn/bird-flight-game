import * as THREE from 'three';

// Seeded, continuous terrain: an open river corridor with wooded mountain banks.
const fract=x=>x-Math.floor(x);
const hash=(x,z)=>fract(Math.sin(x*127.1+z*311.7)*43758.5453);
function noise(x,z){
  const ix=Math.floor(x),iz=Math.floor(z); let u=x-ix,v=z-iz;
  u=u*u*(3-2*u);v=v*v*(3-2*v);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),u),THREE.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),u),v);
}
function fbm(x,z){return noise(x,z)*.56+noise(x*2,z*2)*.27+noise(x*4,z*4)*.12+noise(x*8,z*8)*.05}
const river=z=>Math.sin(z*.022)*8;
export function groundHeight(x,z){
  const bank=THREE.MathUtils.smoothstep(Math.abs(x-river(z)),15,75);
  return -5+bank*(9+fbm(x*.022,z*.022)*54)+fbm(x*.15,z*.15)*bank*3;
}
export function createLandscape(scene,renderer){
  scene.background=new THREE.Color('#b8d5df');
  scene.fog=new THREE.FogExp2('#b8d5df',.0042);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  scene.add(new THREE.HemisphereLight('#d9efff','#566447',2));
  const sun=new THREE.DirectionalLight('#fff0cc',3);sun.position.set(-90,110,-120);scene.add(sun);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(650,32,20),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 p; void main(){vec3 d=normalize(p);float h=max(d.y,0.);vec3 c=mix(vec3(.74,.85,.89),vec3(.16,.43,.68),pow(h,.55));float s=max(dot(d,normalize(vec3(-90.,110.,-120.))),0.);c+=vec3(1.,.8,.45)*pow(s,90.)*.35+vec3(1.,.95,.8)*pow(s,2200.)*2.;gl_FragColor=vec4(c,1.);}`
  }));scene.add(sky);
  const geo=new THREE.PlaneGeometry(650,650,240,240);geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position,colors=[];const color=new THREE.Color();
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,groundHeight(x,z))}
  geo.computeVertexNormals();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),y=pos.getY(i),slope=1-geo.attributes.normal.getY(i);
    color.set(y< -2?'#a39574':slope>.22?'#747a70':'#536744');
    color.multiplyScalar(.72+noise(x*.9,z*.9)*.5);
    colors.push(color.r,color.g,color.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const grain=new Uint8Array(128*128*4);
  for(let i=0;i<128*128;i++){const v=150+hash(i,91)*90;grain[i*4]=v;grain[i*4+1]=v;grain[i*4+2]=v;grain[i*4+3]=255}
  const groundTexture=new THREE.DataTexture(grain,128,128);groundTexture.wrapS=groundTexture.wrapT=THREE.RepeatWrapping;groundTexture.repeat.set(95,95);groundTexture.needsUpdate=true;
  const terrain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,map:groundTexture,bumpMap:groundTexture,bumpScale:.16,roughness:.98}));scene.add(terrain);
  const waterMaterial=new THREE.ShaderMaterial({uniforms:{time:{value:0}},
    vertexShader:'varying vec3 w; void main(){w=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}',
    fragmentShader:`uniform float time;varying vec3 w;
    void main(){vec2 p=w.xz;float a=p.x*2.8+p.y*1.8+sin(p.y*1.7+p.x*.8)*2.+time*1.4;float b=p.x*5.2-p.y*4.7+sin(p.x*3.1)*1.5-time*.85;vec3 n=normalize(vec3(cos(a)*.022+cos(b)*.018,1.,sin(a+b)*.028));vec3 v=normalize(cameraPosition-w);float f=pow(1.-max(dot(n,v),0.),4.);vec3 c=mix(vec3(.035,.19,.20),vec3(.57,.76,.83),f);vec3 l=normalize(vec3(-90.,110.,-120.));float spec=pow(max(dot(n,normalize(l+v)),0.),260.);c+=vec3(1.,.88,.62)*spec*.45;float fog=1.-exp(-pow(length(cameraPosition-w)*.0042,2.));gl_FragColor=vec4(mix(c,vec3(.72,.83,.87),fog),1.);}`
  });
  const water=new THREE.Mesh(new THREE.PlaneGeometry(650,650),waterMaterial);water.rotation.x=-Math.PI/2;water.position.y=-2.6;scene.add(water);
  // Instancing keeps the forest inexpensive on mobile GPUs.
  const trees=[];for(let i=0;i<3600;i++){const x=(hash(i,8)-.5)*480,z=(hash(i,19)-.5)*480;const y=groundHeight(x,z);if(y>0&&y<45&&Math.abs(x-river(z))>23)trees.push({x,y,z,s:2+hash(i,34)*5})}
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.22,1,5),new THREE.MeshStandardMaterial({color:'#594c3b',roughness:1}),trees.length);
  const needles=document.createElement('canvas');needles.width=256;needles.height=512;
  const brush=needles.getContext('2d');
  for(let b=0;b<100;b++){
    const y=25+b*4.5,width=8+b*.94;
    for(const side of [-1,1]){
      const endX=128+side*width,endY=y+12+hash(b,5)*22;
      brush.strokeStyle=b%3===0?'#a6b28a':'#d2d9b5';brush.lineWidth=2;
      brush.beginPath();brush.moveTo(128,y);brush.lineTo(endX,endY);brush.stroke();
      for(let j=0;j<25;j++){const q=j/25,x=128+(endX-128)*q,yy=y+(endY-y)*q;brush.beginPath();brush.moveTo(x,yy);brush.lineTo(x+side*(5+hash(j,b)*10),yy-8-hash(b,j)*12);brush.stroke()}
    }
  }
  const foliageMap=new THREE.CanvasTexture(needles);foliageMap.colorSpace=THREE.SRGBColorSpace;
  const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({map:foliageMap,alphaTest:.45,side:THREE.DoubleSide,roughness:1}),trees.length*3);
  const dummy=new THREE.Object3D();
  trees.forEach(({x,y,z,s},i)=>{
    dummy.position.set(x,y+s*.5,z);dummy.scale.set(.7,s,.7);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);
    for(let k=0;k<3;k++){dummy.position.set(x,y+s*.7,z);dummy.scale.set(s*.75,s*1.35,1);dummy.rotation.y=k*Math.PI/3+hash(i,7)*6.28;dummy.updateMatrix();leaves.setMatrixAt(i*3+k,dummy.matrix);leaves.setColorAt(i*3+k,new THREE.Color().setHSL(.26+hash(i,2)*.05,.22+hash(i,3)*.18,.2+hash(i,5)*.14))}
  });scene.add(trunk,leaves);
  // Soft layered cloud puffs, generated locally with no image downloads.
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');const gradient=ctx.createRadialGradient(64,64,8,64,64,64);gradient.addColorStop(0,'rgba(255,255,255,.65)');gradient.addColorStop(.45,'rgba(255,255,255,.32)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const texture=new THREE.CanvasTexture(canvas);const clouds=[];
  for(let i=0;i<40;i++){const cloud=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,opacity:.65,fog:true}));cloud.position.set((hash(i,61)-.5)*550,75+hash(i,62)*55,(hash(i,63)-.5)*550);cloud.scale.set(60+hash(i,64)*65,18+hash(i,65)*20,1);scene.add(cloud);clouds.push(cloud)}
  return {update(dt,time){waterMaterial.uniforms.time.value=time;for(const cloud of clouds){cloud.position.x+=dt*.5;if(cloud.position.x>300)cloud.position.x=-300}}};
}
