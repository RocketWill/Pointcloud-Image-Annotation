/*
 * @Date: 2022-03-08 13:46:56
 * @Company: Luokung Technology Corp.
 * @LastEditors: Will Cheng Yong
 * @LastEditTime: 2022-03-08 23:39:24
 */
import * as THREE from 'three';
import {
    matmul,
    euler_angle_to_rotate_matrix,
    transpose,
    psr_to_xyz,
    array_as_vector_range,
    array_as_vector_index_range,
    vector_range,
    euler_angle_to_rotate_matrix_3by3
} from "./util.js"

function keyToString(key) {
    return key[0] + ',' + key[1] + ',' + key[2];
}

export function getCoveringPositionIndices(
    points, center, scale,
    rotation, scaleRatioNum,
    pointsIndexGridSize = 1
) {
    const scaleRatio = {
        x: scaleRatioNum,
        y: scaleRatioNum,
        z: scaleRatioNum,
    };
    const scaledScale = {
        x: scale.x * scaleRatio.x,
        y: scale.y * scaleRatio.y,
        z: scale.z * scaleRatio.z,
    }
    const boxCorners = psr_to_xyz(center, scaledScale, rotation); // 长度 32
    const extreme = array_as_vector_range(boxCorners, 4);

    let indices = [];
    let temp;
    for (let x = Math.floor(extreme.min[0] / pointsIndexGridSize); x <= Math.floor(extreme.max[0] / pointsIndexGridSize); x++) {
        for (let y = Math.floor(extreme.min[1] / pointsIndexGridSize); y <= Math.floor(extreme.max[1] / pointsIndexGridSize); y++) {
            for (let z = Math.floor(extreme.min[2] / pointsIndexGridSize); z <= Math.floor(extreme.max[2] / pointsIndexGridSize); z++) {
                const key = keyToString([x, y, z]);
                temp = points.pointsIndex[key];
                if (temp)
                    indices = indices.concat(temp);
            }
        }
    }
    return indices;
}