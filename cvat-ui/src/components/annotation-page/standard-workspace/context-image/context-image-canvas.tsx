/*
 * @Date: 2022-03-29 11:49:05
 * @Company: Luokung Technology Corp.
 * @LastEditors: Will Cheng Yong
 * @LastEditTime: 2022-04-08 15:01:39
 */
// Copyright (C) 2021 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { CombinedState } from 'reducers/interfaces';
import { Canvas } from 'cvat-canvas-wrapper';
import Typography from 'antd/lib/typography';
import { Calib, psrToXyz, points3dHomoToImage2d } from './shared';

const { Paragraph } = Typography;

export interface ImageData {
    size: number[];
    name: string;
    data: string;
}

function boxTo2DPoints(points: number[], calib: Calib) {
    const position = [points[0], points[1], points[2]];
    const rotation = [points[3], points[4], points[5]];
    const scale    = [points[6], points[7], points[8]];
    let box3d = psrToXyz(position, scale, rotation);
    box3d = box3d.slice(0, 8 * 4);
    const box2dPoints = points3dHomoToImage2d(box3d, calib, false, []);
    return box2dPoints;
}

const onCanvasShapeClicked = (e: any): void => {
    const { clientID } = e.detail.state;
    const sidebarItem = window.document.getElementById(`cvat-objects-sidebar-state-item-${clientID}`);
    if (sidebarItem) {
        sidebarItem.scrollIntoView();
    }
};

function ContextImageCanvas({ imageData, imageName, calculateTargetInContext }:
    { imageData: ImageData, imageName: string, calculateTargetInContext: Function }): JSX.Element | null {
    const canvasInstance = useMemo(() => new Canvas(), []);
    canvasInstance.configure({
        smoothImage: true,
        autoborders: true,
        undefinedAttrValue: '__undefined__',
        displayAllText: false,
        forceDisableEditing: false,
        intelligentPolygonCrop: false,
        showProjections: false,
        creationOpacity: 0.03,
        textFontSize: 12,
        textPosition: 'center',
        textContent: '',
    });
    const { frame } = useSelector((state: CombinedState) => state.annotation.player);
    // const state = useSelector((state: CombinedState) => state);
    const { drawing: { activeLabelID }, annotations: { states },
            canvas: { instance }, player: { cameraParam: allCameraParam } }
            = useSelector((state: CombinedState) => state.annotation);
    const cameraParam = allCameraParam?.data?.[imageName];
    const frameData: any = { ...frame };

    const onCanvasShapeUpdate = (event: any): void => {
        if (!cameraParam) return;
        const clientID = event?.detail?.clientID;
        let filteredStates = states.map((state: any) => {
            const box = boxTo2DPoints(state.points, cameraParam)
            if (box) {
                // calculate target quantity in context image
                if (clientID === state.clientID) {
                    calculateTargetInContext(state.clientID, imageName);
                }
                const boxPoints = [
                    box[4], box[5],
                    box[2], box[3],
                    box[6], box[7],
                    box[0], box[1],
                    box[14], box[15],
                    box[8], box[9],
                    box[12], box[13],
                    box[10], box[11]
                ]
                return {
                    points: boxPoints,
                    color: state.label.color,
                    opacity: state.clientID === clientID ? 0.3 : 0.03,
                    clientID: state.clientID,
                    zOrder: state.zOrder,
                    hidden: state.hidden,
                    outside: state.outside,
                    occluded: state.occluded,
                    shapeType: 'cuboid',
                    pinned: state.pinned,
                    descriptions: state.descriptions,
                    frame: state.frame,
                    label: state.label,
                    lock: state.lock,
                    source: state.source,
                    updated: state.updated,
                    attributes: state.attributes,
                }
            }
        })
        filteredStates = filteredStates.filter((state: any) => state !== undefined);
        canvasInstance.setupObjectsUnite(filteredStates);
    }

    useEffect(() => {
        const [wrapper] = window.document.getElementsByClassName(`canvas-context-container-${imageData['name']}`);
        wrapper.appendChild(canvasInstance.html());
        // 隐藏网格
        const grid = canvasInstance.gridSVGElement;
        grid.setAttribute('display', 'none');

        const img = new Image(imageData['size'][1], imageData['size'][0]);  // Image(width, height)
        const base64String = 'data:image/jpeg;base64,' + imageData['data'];
        img.src = base64String;
        img.onload = () => {
            frameData['data'] = async () => (
                {
                    renderWidth: imageData['size'][1],
                    renderHeight: imageData['size'][0],
                    imageData: await createImageBitmap(img)
                }
            )
            frameData['width'] = imageData['size'][1];
            frameData['height'] = imageData['size'][0];
            if (frameData !== null) {
                canvasInstance.setup(
                    frameData,
                    [],
                    0,
                );
            }
            canvasInstance.fitCanvas();
            // onCanvasShapeUpdate(null);  // 初始绘制映射框
        }
    }, [])

    useEffect(() => {
        instance?.html().perspective.addEventListener('canvas.selected', onCanvasShapeUpdate);
        instance?.html().perspective.addEventListener('canvas.edited', onCanvasShapeUpdate);
        canvasInstance.html().addEventListener('canvas.clicked', onCanvasShapeClicked);

        return () => {
            instance?.html().perspective.removeEventListener('canvas.selected', onCanvasShapeUpdate);
            instance?.html().perspective.removeEventListener('canvas.edited', onCanvasShapeUpdate);
            canvasInstance.html().removeEventListener('canvas.clicked', onCanvasShapeClicked);
        };
    }, []);

    useEffect(() => {
        // 初始绘制映射框
        if (states && cameraParam)
            onCanvasShapeUpdate(null);
    }, [states, cameraParam]);

    return (
        <div style={{ margin: 10, marginRight: 20, padding: 10, background: 'rgba(0, 0, 0, 0.05)', borderRadius: 5 }}>
            <div className={`canvas-context-container-${imageData['name']}`}
                style={{
                    overflow: 'hidden',
                    width: '100%',
                    height: 200,
                }}
            />
            {imageData &&
                <Paragraph style={{ margin: '-14px 5px -7px 10px' }}>
                    <pre>{imageData.name}</pre>
                </Paragraph>
            }
        </div>
    );
}

export default React.memo(ContextImageCanvas);
