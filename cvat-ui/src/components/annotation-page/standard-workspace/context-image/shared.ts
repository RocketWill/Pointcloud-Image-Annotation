/*
 * @Date: 2022-04-06 11:31:09
 * @Company: Luokung Technology Corp.
 * @LastEditors: Will Cheng Yong
 * @LastEditTime: 2022-04-07 14:47:33
 */

// matrix (m*n), matrix(n*l), vl: vector length=n
// this matmul is row-wise multiplication. 'x' and result are row-vectors.
// ret^T = m * x^T
//

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

function matmul(m: number[], x: number[], vl: number): number[]  // vl is vector length
{
    const ret = [];
    const resLength = m.length / vl;
    for (let vi = 0; vi < x.length / vl; vi++) {  //vector index
        for (let r = 0; r < m.length / vl; r++){  //row of matrix
            ret[vi * resLength + r] = 0;
            for (let i = 0; i < vl; i++){
                ret[vi * resLength + r] += m[r * vl + i] * x[vi * vl + i];
            }
        }
    }
    return ret;
}

function mat(m: number[], s: number, x: number, y: number): number {
    return m[x * s + y];
}

function matmul2(m: number[], x: number[], vl: number)  //vl is vector length
{
    const ret = [];
    const rows = m.length / vl;
    const cols = x.length / vl;
    for (let r =0; r < rows; r++){
        for (let c = 0; c < cols; c++){
            ret[r * cols + c] = 0;
            for (let i = 0; i < vl; i++){
                ret[r * cols + c] += m[r * vl + i] * x[i * cols + c];
            }
        }
    }
    return ret;
}

function vector4to3(v: number[])
{
    const ret = [];
    for (let i = 0; i < v.length; i++){
        if ((i + 1) % 4 != 0){
            ret.push(v[i]);
        }
    }
    return ret;
}

function vector3Nomalize(m: number[]): number[] {
    const ret = [];
    for (let i = 0; i < m.length / 3; i++) {
        ret.push(m[i * 3 + 0] / m[i * 3 + 2]);
        ret.push(m[i * 3 + 1] / m[i * 3 + 2]);
    }
    return ret;
}

function allPointsInImageRange(p: number[]): boolean {
    for (let i = 0; i < p.length / 3; i++){
        if (p[i * 3 + 2] < 0) {
            return false;
        }
    }
    return true;
}

// box(position, scale, rotation) to box corner corrdinates.
// return 8 points, represented as (x,y,z,1)
// note the vertices order cannot be changed, draw-box-on-image assumes
// the first 4 vertex is the front plane, so it knows box direction.
export function psrToXyz(p: number[], s: number[], r: number[]): number[] {
    const transMatrix = eulerAngleToRotateMatrix(r, p);
    const x = s[0] / 2;
    const y = s[1] / 2;
    const z = s[2] / 2;

    const localCoord = [
    x, y, -z, 1,   x, -y, -z, 1,    // front-left-bottom, front-right-bottom
    x, -y, z, 1,   x, y, z, 1,      // front-right-top,   front-left-top

    -x, y, -z, 1,   -x, -y, -z, 1,  // rear-left-bottom, rear-right-bottom
    -x, -y, z, 1,   -x, y, z, 1,    // rear-right-top,   rear-left-top

    //middle plane
    // 0, y, -z, 1,   0, -y, -z, 1,  //rear-left-bottom, rear-right-bottom
    // 0, -y, z, 1,   0, y, z, 1,  //rear-right-top,   rear-left-top
   ];
    const worldCoord = matmul(transMatrix, localCoord, 4);
    return worldCoord;
}

function eulerAngleToRotateMatrix(eu: number[], tr: number[], order: any = 'ZYX') {
    const theta = [eu[0], eu[1], eu[2]];
    // Calculate rotation about x axis
    const R_x = [
        1,       0,              0,
        0,       Math.cos(theta[0]),   -Math.sin(theta[0]),
        0,       Math.sin(theta[0]),   Math.cos(theta[0])
    ];

    // Calculate rotation about y axis
    const R_y = [
        Math.cos(theta[1]),      0,      Math.sin(theta[1]),
        0,                       1,      0,
        -Math.sin(theta[1]),     0,      Math.cos(theta[1])
    ];

    // Calculate rotation about z axis
    const R_z = [
        Math.cos(theta[2]),    -Math.sin(theta[2]),      0,
        Math.sin(theta[2]),    Math.cos(theta[2]),       0,
        0,               0,                  1];

    const matrices = {
        Z: R_z,
        Y: R_y,
        X: R_x,
    }

    const R = matmul2(matrices[order[2]], matmul2(matrices[order[1]], matrices[order[0]], 3), 3);

    return [
        mat(R,3,0,0), mat(R,3,0,1), mat(R,3,0,2), tr[0],
        mat(R,3,1,0), mat(R,3,1,1), mat(R,3,1,2), tr[1],
        mat(R,3,2,0), mat(R,3,2,1), mat(R,3,2,2), tr[2],
        0,          0,          0,          1,
    ];
}

// points3d is length 4 row vector, homogeneous coordinates
// returns 2d row vectors
export function points3dHomoToImage2d(points3d: number[], calib: Calib, acceptPartial: boolean = false, saveMap: number[][]){
    const extrinsic = [
        calib.r[0][0], calib.r[0][1], calib.r[0][2], calib.t[0],
        calib.r[1][0], calib.r[1][1], calib.r[1][2], calib.t[1],
        calib.r[2][0], calib.r[2][1], calib.r[2][2], calib.t[2],
        0, 0, 0, 1
    ]
    const intrinsic = [
        calib.internal[0][0], calib.internal[0][1], calib.internal[0][2],
        calib.internal[1][0], calib.internal[1][1], calib.internal[1][2],
        calib.internal[2][0], calib.internal[2][1], calib.internal[2][2],
    ]
    const imgpos = matmul(extrinsic, points3d, 4);

    //rect matrix shall be applied here, for kitti
    // if (calib.rect){
    //     imgpos = matmul(calib.rect, imgpos, 4);
    // }
    const imgpos3 = vector4to3(imgpos);
    let imgpos2;
    if (intrinsic.length > 9) {
        imgpos2 = matmul(intrinsic, imgpos, 4);
    }
    else {
        imgpos2 = matmul(intrinsic, imgpos3, 3);
    }

    let imgfinal = vector3Nomalize(imgpos2);

    if (!acceptPartial && !allPointsInImageRange(imgpos3)) {
        return null;
    }

    return imgfinal;
}