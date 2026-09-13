import * as THREE from "three";

export function turboBlurTarget(turbo: number, special: number, enabled: boolean): number {
  return enabled ? THREE.MathUtils.clamp(Math.max(turbo, special) / .25, 0, 1) : 0;
}

/** Blur the already rendered image, preserving scene AA, tone mapping and HUD.
 * Two separable Gaussian passes run at quarter resolution. No second scene render.
 * The captured pixels are already display encoded: shaders deliberately do not
 * apply tone mapping or color-space conversion a second time. */
export class TurboBlur {
  private amount = 0;
  private size = new THREE.Vector2();
  private capture?: THREE.FramebufferTexture;
  private horizontal = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  private vertical = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private blur = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { source: {value: null}, stepSize: {value: new THREE.Vector2()} },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `varying vec2 vUv; uniform sampler2D source; uniform vec2 stepSize;
      void main(){
        vec4 c=texture2D(source,vUv)*.2270270270;
        c+=(texture2D(source,vUv+stepSize*1.3846153846)+texture2D(source,vUv-stepSize*1.3846153846))*.3162162162;
        c+=(texture2D(source,vUv+stepSize*3.2307692308)+texture2D(source,vUv-stepSize*3.2307692308))*.0702702703;
        gl_FragColor=c;
      }`,
  });
  private composite = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false, transparent: true,
    uniforms: { source: {value: this.vertical.texture}, amount: {value: 0} },
    vertexShader: this.blur.vertexShader,
    fragmentShader: `varying vec2 vUv; uniform sampler2D source; uniform float amount;
      void main(){
        vec2 p=abs(vUv-.5)*2.;
        float edge=smoothstep(.48,.96,max(p.x,p.y));
        gl_FragColor=vec4(texture2D(source,vUv).rgb,edge*amount*.85);
      }`,
  });
  private quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), this.blur);

  constructor() { this.quad.frustumCulled=false; this.scene.add(this.quad); }

  render(renderer: THREE.WebGLRenderer, target: number, dt: number) {
    this.amount=THREE.MathUtils.damp(this.amount,target,target>this.amount?10:14,Math.min(.1,Math.max(0,dt)));
    if(this.amount<.003) { this.amount=0; return; }
    renderer.getDrawingBufferSize(this.size);
    const width=this.size.x,height=this.size.y;
    if(!this.capture || this.capture.image.width!==width || this.capture.image.height!==height) {
      this.capture?.dispose();
      this.capture=new THREE.FramebufferTexture(width,height);
      this.capture.minFilter=this.capture.magFilter=THREE.LinearFilter;
      this.horizontal.setSize(Math.max(1,Math.ceil(width/4)),Math.max(1,Math.ceil(height/4)));
      this.vertical.setSize(this.horizontal.width,this.horizontal.height);
    }
    renderer.copyFramebufferToTexture(this.capture);
    const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
    renderer.autoClear=false;
    try {
      this.quad.material=this.blur;
      this.blur.uniforms.source.value=this.capture;
      this.blur.uniforms.stepSize.value.set(2/this.horizontal.width,0);
      renderer.setRenderTarget(this.horizontal); renderer.render(this.scene,this.camera);
      this.blur.uniforms.source.value=this.horizontal.texture;
      this.blur.uniforms.stepSize.value.set(0,2/this.vertical.height);
      renderer.setRenderTarget(this.vertical); renderer.render(this.scene,this.camera);
      this.quad.material=this.composite; this.composite.uniforms.amount.value=this.amount;
      renderer.setRenderTarget(previous); renderer.render(this.scene,this.camera);
    } finally { renderer.setRenderTarget(previous); renderer.autoClear=autoClear; }
  }

  dispose() {
    this.capture?.dispose(); this.horizontal.dispose(); this.vertical.dispose();
    this.blur.dispose(); this.composite.dispose(); this.quad.geometry.dispose();
  }
}
