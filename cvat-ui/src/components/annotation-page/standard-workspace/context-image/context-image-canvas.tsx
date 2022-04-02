/*
 * @Date: 2022-03-29 11:49:05
 * @Company: Luokung Technology Corp.
 * @LastEditors: Will Cheng Yong
 * @LastEditTime: 2022-04-02 17:24:39
 */
// Copyright (C) 2021 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { CombinedState } from 'reducers/interfaces';
import { Canvas } from 'cvat-canvas-wrapper';
import Typography from 'antd/lib/typography';

const { Paragraph } = Typography;

export interface ImageData {
    size: number[];
    name: string;
    data: string;
}

// function onCanvasShapeDrawn(event: any) {
//     console.log("🤡 ~ file: context-image-canvas.tsx ~ line 26 ~ onCanvasShapeDrawn ~ event", event)
// }

// function onCanvasEditDone(event: any) {
//     console.log("🤡 ~ file: context-image-canvas.tsx ~ line 30 ~ onCanvasEditDone ~ event", event)
// }

function ContextImageCanvas({ imageData, imageName }: { imageData: ImageData, imageName: string }): JSX.Element | null {
    const { frame } = useSelector((state: CombinedState) => state.annotation.player);
    const state = useSelector((state: CombinedState) => state);
    console.log("🤡 ~ file: context-image-canvas.tsx ~ line 36 ~ ContextImageCanvas ~ state", state)
    const { drawing: { activeLabelID }, annotations,
            canvas: { contextMenu: { visible: contextMenuVisibility }, instance } }
            = useSelector((state: CombinedState) => state.annotation);
    const canvasInstance = new Canvas();
    const frameData: any = { ...frame };

    const onCanvasShapeDrawn = (event) => {
        console.log("🤡 ~ file: context-image-canvas.tsx ~ line 42 ~ onCanvasShapeDrawn ~ event", event)
    }

    const onCanvasEditDone = (event) => {
        console.log("🤡 ~ file: context-image-canvas.tsx ~ line 42 ~ onCanvasShapeDrawn ~ event", event)
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
        }
    }, [])

    useEffect(() => {
        instance?.html().perspective.addEventListener('canvas.selected', onCanvasShapeDrawn);
        instance?.html().perspective.addEventListener('canvas.edited', onCanvasEditDone);

        return () => {
            instance?.html().perspective.removeEventListener('canvas.selected', onCanvasShapeDrawn);
            instance?.html().perspective.removeEventListener('canvas.edited', onCanvasEditDone);
        };
    }, []);

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
