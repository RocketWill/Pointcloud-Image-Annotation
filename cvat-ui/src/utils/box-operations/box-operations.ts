export interface Calib {
  height: number;
  width: number;
  cameraMappingType: 'GENERAL' | 'ADDT' | 'SUBT';
  distortionType: 'RADTAN' | 'FISHEYE' | 'FISHEYE_ATANT2';
  imageMappingType: 'GENERAL' | 'FISHEYE' | 'FISHEYE_2';
  r: number[][];
  t: number[];
  internal: number[][];
  radial: number[];
  tangential: number[];
  lens: number[];
}

export function wrapPsrToXyz(Module: any): any {
    // JS-friendly wrapper around the WASM call
    return function (position: number[], scale: number[], rotation: number[]): number[] {
      const length = position.length;
      const flatPosition = new Float32Array(position);
      const flateScale = new Float32Array(scale);
      const flatRotation = new Float32Array(rotation);
      const buffer1 = Module._malloc(
        flatPosition.length * flatPosition.BYTES_PER_ELEMENT
      );
      const buffer2 = Module._malloc(
        flateScale.length * flateScale.BYTES_PER_ELEMENT
      );
      const buffer3 = Module._malloc(
        flatRotation.length * flatRotation.BYTES_PER_ELEMENT
      );
      Module.HEAPF32.set(flatPosition, buffer1 >> 2);
      Module.HEAPF32.set(flateScale, buffer2 >> 2);
      Module.HEAPF32.set(flatRotation, buffer3 >> 2);

      // allocate memory for the result array
      const resultBuffer = Module._malloc(
        32 * flatPosition.BYTES_PER_ELEMENT
      );
      // make the call
      const resultPointer = Module.ccall(
        "psrToXyz",
        "number",
        ["number", "number", "number", "number", "number"],
        [buffer1, buffer2, buffer3, resultBuffer, 32]
      );

      const resultFlatArray = [];
      for (let i = 0; i < 32; i++) {
        resultFlatArray.push(
          Module.HEAPF32[resultPointer / Float32Array.BYTES_PER_ELEMENT + i]
        );
      }
      Module._free(buffer1);
      Module._free(buffer2);
      Module._free(buffer3);
      Module._free(resultBuffer);
      return resultFlatArray;
    };
}

export function wrapPoints3dHomoToImage2d(Module: any): any {
    // JS-friendly wrapper around the WASM call
    return function (points3d: number[], calib: Calib): any {
      const length = points3d.length;
      const extrinsic = [
        calib.r[0][0], calib.r[0][1], calib.r[0][2], calib.t[0],
        calib.r[1][0], calib.r[1][1], calib.r[1][2], calib.t[1],
        calib.r[2][0], calib.r[2][1], calib.r[2][2], calib.t[2],
        0.0, 0.0, 0.0, 1.0
      ]
      const intrinsic = [
          calib.internal[0][0], calib.internal[0][1], calib.internal[0][2],
          calib.internal[1][0], calib.internal[1][1], calib.internal[1][2],
          calib.internal[2][0], calib.internal[2][1], calib.internal[2][2],
      ]
      const img_width = calib.width;
      const img_height = calib.height;

      // set up input arrays with the input data
      const flatPoints3d = new Float32Array(points3d);
      const flateExtrinsic = new Float32Array(extrinsic);
      const flatIntrinsic = new Float32Array(intrinsic);
      const buffer1 = Module._malloc(
        flatPoints3d.length * flatPoints3d.BYTES_PER_ELEMENT
      );
      const buffer2 = Module._malloc(
        flateExtrinsic.length * flateExtrinsic.BYTES_PER_ELEMENT
      );
      const buffer3 = Module._malloc(
        flatIntrinsic.length * flatIntrinsic.BYTES_PER_ELEMENT
      );
      Module.HEAPF32.set(flatPoints3d, buffer1 >> 2);
      Module.HEAPF32.set(flateExtrinsic, buffer2 >> 2);
      Module.HEAPF32.set(flatIntrinsic, buffer3 >> 2);

      // allocate memory for the result array
      const resultBuffer = Module._malloc(
        16 * flatPoints3d.BYTES_PER_ELEMENT
      );

      // make the call
      const resultPointer = Module.ccall(
        "points3dHomoToImage2d",
        "number",
        ["number", "number", "number", "number", "number", "number", "number"],
        [buffer1, buffer2, buffer3, resultBuffer, img_width, img_height, 16]
      );

      const resultFlatArray = [];
      for (let i = 0; i < 16; i++) {
        resultFlatArray.push(
          Module.HEAPF32[resultPointer / Float32Array.BYTES_PER_ELEMENT + i]
        );
      }
      Module._free(buffer1);
      Module._free(buffer2);
      Module._free(buffer3);
      Module._free(resultBuffer);
      return resultFlatArray.every(item => item === 0) ? null : resultFlatArray;
    };
}