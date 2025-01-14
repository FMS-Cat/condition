import { BufferRenderTarget } from '../heck/BufferRenderTarget';
import { Entity, EntityOptions } from '../heck/Entity';
import { Geometry } from '../heck/Geometry';
import { Lambda } from '../heck/components/Lambda';
import { LightEntity } from './LightEntity';
import { Material } from '../heck/Material';
import { Mesh } from '../heck/components/Mesh';
import { dummyRenderTarget } from '../globals/dummyRenderTarget';
import { genCube } from '../geometries/genCube';
import { gl } from '../globals/canvas';
import { randomTexture } from '../globals/randomTexture';
import lightShaftFrag from '../shaders/light-shaft.frag';
import lightShaftVert from '../shaders/light-shaft.vert';

interface LightShaftOptions extends EntityOptions {
  light: LightEntity;
  intensity?: number;
}

export class LightShaft extends Entity {
  private __forward: Material;

  public constructor( options: LightShaftOptions ) {
    super( options );

    const { light, intensity } = options;

    // -- geometry ---------------------------------------------------------------------------------
    const cube = genCube();

    const geometry = new Geometry();

    geometry.vao.bindVertexbuffer( cube.position, 0, 3 );
    geometry.vao.bindIndexbuffer( cube.index );

    geometry.count = cube.count;
    geometry.mode = cube.mode;
    geometry.indexType = cube.indexType;

    // -- materials --------------------------------------------------------------------------------
    const forward = this.__forward = new Material(
      lightShaftVert,
      lightShaftFrag,
      {
        initOptions: { geometry: geometry, target: dummyRenderTarget },
        blend: [ gl.ONE, gl.ONE ],
      },
    );

    forward.addUniform( 'intensity', '1f', intensity ?? 0.01 );

    forward.addUniformTextures( 'samplerRandom', randomTexture.texture );
    forward.addUniformTextures( 'samplerShadow', light.shadowMap.texture );

    const materials = { forward };

    // -- updater ----------------------------------------------------------------------------------
    this.components.push( new Lambda( {
      onDraw: ( event ) => {
        forward.addUniform( 'lightFov', '1f', light.shadowMapFov );
        forward.addUniform( 'lightNearFar', '2f', light.shadowMapNear, light.shadowMapFar );
        forward.addUniform( 'lightPos', '3f', ...light.globalTransformCache.position.elements );
        forward.addUniform( 'lightColor', '3f', ...light.color );

        forward.addUniformMatrixVector(
          'lightPV',
          'Matrix4fv',
          light.camera.projectionMatrix.multiply(
            light.globalTransformCache.matrix.inverse!
          ).elements,
        );

        forward.addUniform(
          'cameraNearFar',
          '2f',
          event.camera.near,
          event.camera.far
        );
      },
      name: process.env.DEV && 'updater',
    } ) );

    // -- mesh -------------------------------------------------------------------------------------
    const mesh = new Mesh( {
      geometry,
      materials,
      name: process.env.DEV && 'mesh',
    } );
    mesh.depthTest = false;
    mesh.depthWrite = false;
    this.components.push( mesh );
  }

  /**
   * どうやってフレームバッファのデプスを取るかわかりませんでした 許してほしい
   */
  public setDefferedCameraTarget( deferredCameraTarget: BufferRenderTarget ): void {
    this.__forward.addUniformTextures( 'samplerDeferred0', deferredCameraTarget.texture );
  }
}
