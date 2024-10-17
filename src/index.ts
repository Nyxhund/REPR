import { GUI } from 'dat.gui';
import { mat4, vec3 } from 'gl-matrix';
import { Camera } from './camera';
import { SphereGeometry } from './geometries/sphere';
import { GLContext } from './gl';
import { PointLight } from './lights/lights';
import { PBRShader } from './shader/pbr-shader';
import { Texture, Texture2D } from './textures/texture';
import { UniformType } from './types';

// GUI elements
interface GUIProperties {
    BRDF: boolean;
    IBL: boolean;
    Reinhard: boolean;
    ACES: boolean;
    albedo: number[];
    lightColor1: number[];
    lightIntensity1: number;
    lightColor2: number[];
    lightIntensity2: number;
    lightColor3: number[];
    lightIntensity3: number;
    lightColor4: number[];
    lightIntensity4: number;
}

/**
 * Class representing the current application with its state.
 *
 * @class Application
 */
class Application {
  private _context: GLContext; // Context used to draw to the canvas
  private _shader: PBRShader;
  private _geometry: SphereGeometry;
  private _uniforms: Record<string, UniformType | Texture>;
  private _textureExample: Texture2D<HTMLElement> | null;
  private _camera: Camera;
  private _guiProperties: GUIProperties; // Object updated with the properties from the GUI
  private _lights : [PointLight, PointLight, PointLight, PointLight];

  constructor(canvas: HTMLCanvasElement) {
    this._context = new GLContext(canvas);
    this._camera = new Camera(0.0, 0.0, 18.0);
    this._geometry = new SphereGeometry();
    this._shader = new PBRShader();
    this._textureExample = null;
    this._lights = [new PointLight, new PointLight, new PointLight, new PointLight];
    this._uniforms = {
      'uMaterial.albedo': vec3.create(),
      'uModel.LS_to_WS': mat4.create(),
      'uCamera.WS_to_CS': mat4.create(),
      'uCamera.position': vec3.create(),
      'uCameraFrag.position': vec3.create(),
      'uMode.mode': 0,
    };

    // Set GUI default values

    this._guiProperties = {
      BRDF: false,
      IBL: true,
      Reinhard: false,
      ACES: true,
      albedo: [255, 255, 255],
      lightColor1: [255, 255, 255],
      lightIntensity1: 0.5,
      lightColor2: [255, 255, 255],
      lightIntensity2: 0.5,
      lightColor3: [255, 255, 255],
      lightIntensity3: 0.5,
      lightColor4: [255, 255, 255],
      lightIntensity4: 0.5,
    };

    let setChecked = (prop : string) => {
        this._guiProperties['BRDF'] = false;
        this._guiProperties['IBL'] = false;
        this._guiProperties[prop] = true;
    }

    let setToneChecked = (prop : string) => {
        this._guiProperties['Reinhard'] = false;
        this._guiProperties['ACES'] = false;
        this._guiProperties[prop] = true;
    }

    // Creates a GUI floating on the upper right side of the page.
    // You are free to do whatever you want with this GUI.
    // It's useful to have parameters you can dynamically change to see what happens.
    const gui = new GUI();
    gui.add(this._guiProperties, 'BRDF').listen().onChange(() => setChecked('BRDF'));
    gui.add(this._guiProperties, 'IBL').listen().onChange(() => setChecked('IBL'));

    const folderTone = gui.addFolder("Tone mapping");
    folderTone.add(this._guiProperties, 'Reinhard').listen().onChange(() => setToneChecked('Reinhard'));
    folderTone.add(this._guiProperties, 'ACES').listen().onChange(() => setToneChecked('ACES'));

    gui.addColor(this._guiProperties, 'albedo');

    const folder1 = gui.addFolder("Light 1");
    folder1.addColor(this._guiProperties, 'lightColor1').name("Color");
    folder1.add(this._guiProperties, 'lightIntensity1').name("Intensity");

    const folder2 = gui.addFolder("Light 2");
    folder2.addColor(this._guiProperties, 'lightColor2').name("Color");
    folder2.add(this._guiProperties, 'lightIntensity2').name("Intensity");

    const folder3 = gui.addFolder("Light 3");
    folder3.addColor(this._guiProperties, 'lightColor3').name("Color");
    folder3.add(this._guiProperties, 'lightIntensity3').name("Intensity");

    const folder4 = gui.addFolder("Light 4");
    folder4.addColor(this._guiProperties, 'lightColor4').name("Color");
    folder4.add(this._guiProperties, 'lightIntensity4').name("Intensity");

    this._lights[0].setPosition(8, 0, 9);

    this._lights[1].setPosition(-3, 0, 5);

    this._lights[2].setPosition(1, 0, 17);

    this._lights[3].setPosition(1, 0, 17);
  }

  /**
   * Initializes the application.
   */
  async init() {
    this._context.uploadGeometry(this._geometry);
    this._context.compileProgram(this._shader);

    // Example showing how to load a texture and upload it to GPU.
    this._textureExample = await Texture2D.load(
      'assets/env/Alexs_Apt_2k-diffuse-RGBM.png'
    );
    if (this._textureExample !== null) {
      this._context.uploadTexture(this._textureExample);
      // You can then use it directly as a uniform:
      // ```uniforms.myTexture = this._textureExample;```
      this._uniforms['uTextureDiffuse'] = this._textureExample;
    }

    this._textureExample = await Texture2D.load(
      'assets/env/Alexs_Apt_2k-specular-RGBM.png'
    );
    if (this._textureExample !== null) {
      this._context.uploadTexture(this._textureExample);
      // You can then use it directly as a uniform:
      // ```uniforms.myTexture = this._textureExample;```
      this._uniforms['uTextureSpecular'] = this._textureExample;
    }

    this._textureExample = await Texture2D.load(
      'assets/ggx-brdf-integrated.png'
    );
    if (this._textureExample !== null) {
      this._context.uploadTexture(this._textureExample);
      // You can then use it directly as a uniform:
      // ```uniforms.myTexture = this._textureExample;```
      this._uniforms['uTexturePreIntBRDF'] = this._textureExample;
    }

    // Handle keyboard and mouse inputs to translate and rotate camera.
    canvas.addEventListener('keydown', this._camera.onKeyDown.bind(this._camera), true);
    canvas.addEventListener('pointerdown', this._camera.onPointerDown.bind(this._camera), true);
    canvas.addEventListener('pointermove', this._camera.onPointerMove.bind(this._camera), true);
    canvas.addEventListener('pointerup', this._camera.onPointerUp.bind(this._camera), true);
    canvas.addEventListener('pointerleave', this._camera.onPointerUp.bind(this._camera), true);
  }

  /**
   * Called at every loop, before the [[Application.render]] method.
   */
  update() {
    /** Empty. */
  }

  /**
   * Called when the canvas size changes.
   */
  resize() {
    this._context.resetViewport();
  }

  /**
   * Called at every loop, after the [[Application.update]] method.
   */
  render() {
    this._context.clear();
    this._context.setDepthTest(true);

    const props = this._guiProperties;

    // Set the albedo uniform using the GUI value
    this._uniforms['uMaterial.albedo'] = vec3.fromValues(
      props.albedo[0] / 255,
      props.albedo[1] / 255,
      props.albedo[2] / 255);

    this._lights[0].setIntensity(props.lightIntensity1);
    this._lights[1].setIntensity(props.lightIntensity2);
    this._lights[2].setIntensity(props.lightIntensity3);
    this._lights[3].setIntensity(props.lightIntensity4);

    this._lights[0].setColorRGB(props.lightColor1[0], props.lightColor1[1], props.lightColor1[2]);
    this._lights[1].setColorRGB(props.lightColor2[0], props.lightColor2[1], props.lightColor2[2]);
    this._lights[2].setColorRGB(props.lightColor3[0], props.lightColor3[1], props.lightColor3[2]);
    this._lights[3].setColorRGB(props.lightColor4[0], props.lightColor4[1], props.lightColor4[2]);

    // Set World-Space to Clip-Space transformation matrix (a.k.a view-projection).
    const aspect = this._context.gl.drawingBufferWidth / this._context.gl.drawingBufferHeight;
    let WS_to_CS = this._uniforms['uCamera.WS_to_CS'] as mat4;
    mat4.multiply(WS_to_CS, this._camera.computeProjection(aspect), this._camera.computeView());

    // Set Camera position
    this._uniforms['uCamera.position'] = this._camera._position;
    this._uniforms['uCameraFrag.position'] = this._camera._position;

    // Set Lights
    for (const [index, light] of this._lights.entries())
    {
        this._uniforms['uLights[' + index + '].color'] = light.color;
        this._uniforms['uLights[' + index + '].intensity'] = light.intensity;
        this._uniforms['uLights[' + index + '].positionWS'] = light.positionWS;
    }

    // Set Mode
    this._uniforms['uMode.mode'] = props.IBL ? 1 : 0;
    this._uniforms['uMode.tone'] = props.Reinhard ? 1 : 0;

    // Draw the 5x5 grid of spheres
    const rows = 5;
    const columns = 5;
    const spacing = this._geometry.radius * 2.5;
    for (let r = 0; r < rows; ++r) {
      for (let c = 0; c < columns; ++c) {

        // Set Local-Space to World-Space transformation matrix (a.k.a model).
        const WsSphereTranslation = vec3.fromValues(
          (c - columns * 0.5) * spacing + spacing * 0.5,
          (r - rows * 0.5) * spacing + spacing * 0.5,
          0.0
        );
        const LS_to_WS = this._uniforms["uModel.LS_to_WS"] as mat4;
        mat4.fromTranslation(LS_to_WS, WsSphereTranslation);
        this._uniforms['uMaterial.roughness'] = c * 0.18 + 0.01;
        this._uniforms['uMaterial.metalness'] = r * 0.23 + 0.01;

        // Draw the triangles
        this._context.draw(this._geometry, this._shader, this._uniforms);
      }
    }
  }
}

const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
const app = new Application(canvas as HTMLCanvasElement);
app.init();

function animate() {
  app.update();
  app.render();
  window.requestAnimationFrame(animate);
}
animate();

/**
 * Handles resize.
 */
const resizeObserver = new ResizeObserver((entries) => {
  if (entries.length > 0) {
    const entry = entries[0];
    canvas.width = window.devicePixelRatio * entry.contentRect.width;
    canvas.height = window.devicePixelRatio * entry.contentRect.height;
    app.resize();
  }
});

resizeObserver.observe(canvas);
