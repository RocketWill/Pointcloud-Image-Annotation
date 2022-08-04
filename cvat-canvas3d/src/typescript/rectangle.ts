import * as THREE from 'three';
import { ViewType } from './canvas3dModel';
import { transpose, euler_angle_to_rotate_matrix, vector_range, matmul } from './utils/util.js';
import PointInPoly from "./utils/point-in-polygon.js";
import PolyBool from "polybooljs";
import constants from './consts';


export interface Cube {
    position: THREE.Vector3;
    rotation: THREE.Vector3;
    scale: THREE.Vector3;
}

export class RectangleModel {
    public scenePointMesh: THREE.Points;  // 场景所有点云
    private selection: Set<number>;
    private transUtmScene = new THREE.Matrix4().identity().setPosition(0, 0, 0);  // 单位矩阵
    private transSceneLidar = new THREE.Matrix4().copy(this.transUtmScene).invert();

    public constructor(points: THREE.Points) {
        this.scenePointMesh = points;
        this.selection = new Set<number>();
    }

    public updateScenePointMesh(pointMesh: THREE.Points): void {
        this.scenePointMesh = pointMesh;
    }

    private lidarPosToScene(position: THREE.Vector3): THREE.Vector3 {
        const tp = new THREE.Vector3(position.x, position.y, position.z).applyMatrix4(this.transUtmScene);
        return tp;
    }

    private translateBoxPosition(position: {x: number, y: number, z: number}, theta: number, axis: string, delta: number): void {
        switch (axis) {
            case 'x':
                position.x += delta * Math.cos(theta);
                position.y += delta * Math.sin(theta);
                break;
            case 'y':
                position.x += delta * Math.cos(Math.PI / 2 + theta);
                position.y += delta * Math.sin(Math.PI / 2 + theta);
                break;
            case 'z':
                position.z += delta;
                break;
        }
    }

    private pointsToCuboid(camera: any): Cube | null {
        const pointIndices = [...this.selection];
        if (pointIndices.length < 1)
            return null;
        const points = this.scenePointMesh.geometry.getAttribute("position").array;
        const rotationZ = camera.rotation.z + Math.PI / 2;
        const trans = transpose(euler_angle_to_rotate_matrix({ x: 0, y: 0, z: rotationZ }, { x: 0, y: 0, z: 0 }), 4);
        const center = { x: 0, y: 0, z: 0 };

        pointIndices.forEach((i: number) => {
            center.x += points[i * 3];
            center.y += points[i * 3 + 1];
            center.z += points[i * 3 + 2];
        });
        center.x /= pointIndices.length;
        center.y /= pointIndices.length;
        center.z /= pointIndices.length;
        center.z = 0;

        const relativePosition: any = [];
        pointIndices.forEach((i: number) => {
            const x = points[i * 3];
            const y = points[i * 3 + 1];
            const z = points[i * 3 + 2];
            const p = [x - center.x, y - center.y, z - center.z, 1];
            const tp = matmul(trans, p, 4);
            relativePosition.push([tp[0], tp[1], tp[2]]);
        });
        const relativeExtreme = vector_range(relativePosition);
        const scale = {
            x: relativeExtreme.max[0] - relativeExtreme.min[0],
            y: relativeExtreme.max[1] - relativeExtreme.min[1],
            z: relativeExtreme.max[2] - relativeExtreme.min[2],
        };

        this.translateBoxPosition(center, rotationZ, "x", relativeExtreme.min[0] + scale.x / 2);
        this.translateBoxPosition(center, rotationZ, "y", relativeExtreme.min[1] + scale.y / 2);
        this.translateBoxPosition(center, rotationZ, "z", relativeExtreme.min[2] + scale.z / 2);
        scale.x += 0.02;
        scale.y += 0.02;
        scale.z += 0.02;

        const cube: Cube = {
            position: new THREE.Vector3(center.x, center.y, center.z),
            rotation: new THREE.Vector3(0, 0, rotationZ),
            scale: new THREE.Vector3(scale.x, scale.y, scale.z),
        }

        return cube;
    }

    private addIndexToSelection(idx: number): void {
        this.selection.add(idx);
    }

    private rectToPolygon(rect: number[]): number[][] {
        const [x0, y0, x1, y1] = rect;
        const polygon = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
        return polygon;
    }

    private selectByRectangle(rect: number[], camera: any): void {
        const inside = new Set<number>();
        const polygon = this.rectToPolygon(rect);
        let pt = new THREE.Vector3();
        const points = this.scenePointMesh.geometry.getAttribute("position").array;
        const pointCloudLength = points.length / 3;


        for (let i = 0; i < pointCloudLength; i++) {
            pt.set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
            pt = this.lidarPosToScene(pt);

            pt.project(camera);
            const inPolygon = PointInPoly.pointInPolyWindingNumber([pt.x, pt.y], polygon);
            if (inPolygon && pt.z > 0.5) {
                inside.add(i);
            }
        }

        if (inside.size > 0) {
            inside.forEach((idx: number) => this.addIndexToSelection(idx));
        }
    }

    public createAnno(rect: number[], camera: any): Cube | null {
        this.selectByRectangle(rect, camera);
        return this.pointsToCuboid(camera);
    }
}