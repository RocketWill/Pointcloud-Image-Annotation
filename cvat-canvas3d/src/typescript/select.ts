import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { ViewType } from './canvas3dModel';
import PointInPoly from "./utils/point-in-polygon.js";
import hull from "hull.js";
import PolyBool from "polybooljs";
import constants from './consts';

const PI = Math.PI;
const DOUBLEPI = PI * 2;
const HALFPI = PI / 2;
const modulo = (x: number): number => (x % DOUBLEPI + DOUBLEPI) % DOUBLEPI;
const moduloHalfPI = (x: number): number => modulo(x + PI) - PI;
const round2 = (x: number): number => Math.round(x * 100) / 100;

export enum SelectionMode {
    ADD = 'add',
    TOGGLE = 'toggle',
    REMOVE = 'remove',
    UNKNOWN = 'unknown'
}

export interface ScreenSize {
    clientWidth: number;
    clientHeight: number;
}

export interface MousePosition {
    x: number;
    y: number;
}

export class SelectModel {
    public scenePointMesh: THREE.Points;  // 场景所有点云
    public selectMode: SelectionMode;
    private name: any;
    private polygon: number[];  // 框选的矩形区域
    private convexHull: number[][];
    private selection: Set<number>;
    private pointColor: THREE.Color;
    private canvasInstance: any;
    private inside: Set<number>;
    private outside: Set<number>;
    private transUtmScene = new THREE.Matrix4().identity().setPosition(0, 0, 0);  // 单位矩阵
    private transSceneLidar = new THREE.Matrix4().copy(this.transUtmScene).invert();

    public constructor(points: THREE.Points, pointColor: string) {
        this.scenePointMesh = points;
        this.pointColor = new THREE.Color(pointColor);
        this.selectMode = SelectionMode.ADD;
        this.selection = new Set<number>();
        this.convexHull = [];
    }

    public updateScenePointMesh(pointMesh: THREE.Points): void {
        this.scenePointMesh = pointMesh;
    }

    public setName(clientId: any): void {
        this.name = clientId;
    }

    public getName(): any {
        return this.name;
    }

    public setColor(color: string): void {
        this.pointColor = new THREE.Color(color);
    }

    public setPolygon(polygon: number[]) {
        this.polygon = polygon;
    }

    private lidarPosToScene(position: THREE.Vector3): THREE.Vector3 {
        const tp = new THREE.Vector3(position.x, position.y, position.z).applyMatrix4(this.transUtmScene);
        return tp;
    }

    private updatePointIndicesRegion(inside: Set<number>, outside: Set<number>) {
        this.inside = inside;
        this.outside = outside;
    }

    public removeScene() {

    }

    private addIndexToSelection(idx: number): void {
        this.selection.add(idx);
    }

    private removeIndexFromSelection(idx: number): void {
        this.selection.delete(idx);
    }

    private processSelection(idx: number): void {
        if (this.selectMode === SelectionMode.ADD) {
            this.addIndexToSelection(idx);
        } else if (this.selectMode === SelectionMode.REMOVE) {
            this.removeIndexFromSelection(idx);
        } else if (this.selectMode === SelectionMode.TOGGLE) {
            if (this.selection.has(idx)) {
                this.removeIndexFromSelection(idx);
            } else {
                this.addIndexToSelection(idx);
            }
        } else {
            console.error("Invalid select mode.");
        }
    }

    private toScreenCoord(polygon: number[][], size: ScreenSize): number[][] {
        const screenCoordPoly: number[][] = [];
        polygon.forEach((coord: number[]) => {
            const x: number = Math.round((coord[0] + 1 ) * size.clientWidth / 2);
            const y: number = Math.round((-coord[1] + 1 ) * size.clientHeight / 2);
            screenCoordPoly.push([x, y]);
        })
        return screenCoordPoly;
    }

    private selectByPolygon(polygon: number[][], camera: any): Set<number>[] {
        const inside = new Set<number>();
        const outside = new Set<number>();
        let pt = new THREE.Vector3();
        const points = this.scenePointMesh.geometry.getAttribute("position").array;
        const pointCloudLength = points.length / 3;

        for (let i = 0; i < pointCloudLength; i++) {
            pt.set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
            pt = this.lidarPosToScene(pt);

            pt.project(camera);
            // pt.x = Math.round((pt.x + 1 ) * size[0] / 2);
            // pt.y = Math.round((-pt.y + 1 ) * size[1] / 2);
            const inPolygon = PointInPoly.pointInPolyWindingNumber([pt.x, pt.y], polygon);
            if (inPolygon) {
                inside.add(i);
            }
            else {
                outside.add(i);
            }
        }

        if (inside.size > 0) {
            inside.forEach((idx: number) => this.processSelection(idx));
        }
        this.updatePointIndicesRegion(inside, outside);
        return [inside, outside];
    }

    private flattenArray(arr: number[][]): number[] {
        const flattened: number[] = [];
        arr.forEach((subArr: number[]) => flattened.push(subArr[0], subArr[1]));
        return flattened;
    }

    public loadAnno(indices: number[]) {
        this.selection = new Set<number>(indices);
        // 绘制框内的颜色
        const colorArray: number[] = this.scenePointMesh.geometry.getAttribute("color").array as number[];
        this.selection.forEach((i: number) => {
            colorArray[i * 3] = this.pointColor.r;
            colorArray[i * 3 + 1] = this.pointColor.g;
            colorArray[i * 3 + 2] = this.pointColor.b;
        })
    }

    public updateConvexHull(camera: any): void {
        if (this.selection.size < 1) {
            console.log("Point cloud selection < 1.");
            return null;
        }
        const drawnPolygon = this.getDrawPolygon(camera);
        this.convexHull = drawnPolygon;
    }

    public getConvexHull(camera: any, screenSize: ScreenSize, flatten: boolean = true): any {
        this.updateConvexHull(camera);
        const drawnPolygon = this.convexHull;
        const drawnPolygonScreenCoord = this.toScreenCoord(drawnPolygon, screenSize);
        if (flatten) {
            return this.flattenArray(drawnPolygonScreenCoord);
        } else {
            return drawnPolygonScreenCoord;
        }
    }

    public createAnno(polygon: number[][], camera: any, screenSize: ScreenSize) {
        const _ = this.selectByPolygon(polygon, camera);
        const colorArray: number[] = this.scenePointMesh.geometry.getAttribute("color").array as number[];
        // 绘制框内的颜色
        this.selection.forEach((i: number) => {
            colorArray[i * 3] = this.pointColor.r;
            colorArray[i * 3 + 1] = this.pointColor.g;
            colorArray[i * 3 + 2] = this.pointColor.b;
        })
        this.scenePointMesh.geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
        const drawnPolygon = this.getDrawPolygon(camera);
        const drawnPolygonScreenCoord = this.toScreenCoord(drawnPolygon, screenSize);

        return {
            indices: this.selection,
            polygon: this.flattenArray(drawnPolygonScreenCoord),
        };
    }

    public isSelect(mousePosition: MousePosition): Boolean {
        return PointInPoly.pointInPolyWindingNumber(
            [mousePosition.x, mousePosition.y], this.convexHull
        );
    }

    private getDrawPolygon(camera: any): number[][] {
        if (this.selection.size > 0) {
            const selectionPts: number[][] = [];
            let pt = new THREE.Vector3();
            const points = this.scenePointMesh.geometry.getAttribute("position").array;
            this.selection.forEach((idx: number) => {
                pt.set(points[idx * 3], points[idx * 3 + 1], points[idx * 3 + 2]);
                pt = this.lidarPosToScene(pt);
                pt.project(camera);
                selectionPts.push([pt.x, pt.y]);
            })
            if (selectionPts.length < 3) {
                console.error("Draw polygon should contain at least 3 points.");
                return;
            }
            const filtered = selectionPts.filter((pt: number[]) => !isNaN(pt[0]) && !isNaN(pt[1]));
            let hullPol = hull(filtered, Infinity);  // 第二个参数为凹面(concavity)数量，默认20
            hullPol.splice(-1, 1);
            if (hullPol.length < 3)
                return;
            const drawCircle = (x: number, y: number, r: number): number[][] => {
                const pts = [];
                const total = 8;
                for (let i = 0; i <= total; i++) {
                    pts.push([x + Math.cos(DOUBLEPI * i / total) * r, y + Math.sin(DOUBLEPI * i / total) * r]);
                    return pts;
                }
            }
            const circles: number[][][] = [];
            hullPol.forEach((pt: number[]) => {
                circles.push(drawCircle(pt[0], pt[1], 5));
            })
            const polygons = [];
            const polyFromArr = ((pts: any) => {
                return {
                    regions: [pts],
                    inverted: false
                }
            });
            polygons.push(polyFromArr(hullPol));
            circles.forEach((circle: number[][]) => {
                polygons.push(polyFromArr(circle));
            })
            let segments = PolyBool.segments(polygons[0]);
            for (let i = 1; i < polygons.length; i++) {
                const seg2 = PolyBool.segments(polygons[i]);
                const comb = PolyBool.combine(segments, seg2);
                segments = PolyBool.selectUnion(comb);
            }
            return PolyBool.polygon(segments).regions[0];
            // hullPol = lineclip.polygon(hullPol, this.clippingBox);  // 超出画面截断
        }
    }
}