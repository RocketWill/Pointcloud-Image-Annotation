/*
 * @Date: 2022-03-29 11:49:05
 * @Company: Luokung Technology Corp.
 * @LastEditors: Will Cheng Yong
 * @LastEditTime: 2022-03-29 14:03:06
 */
// Copyright (C) 2021 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Typography from 'antd/lib/typography';
import { CombinedState } from 'reducers/interfaces';
import { hideShowContextImage, getContextImageAsync } from 'actions/annotation-actions';
import { Canvas, CanvasMode } from 'cvat-canvas-wrapper';
import CVATTooltip from 'components/common/cvat-tooltip';

function ContextImageCanvas({ imageData }): JSX.Element | null {
    const state = useSelector((state: CombinedState) => state);
    const frameData = { ...state.annotation.player.frame };

    useEffect(() => {
        const canvasInstance = new Canvas();
        const [wrapper] = window.document.getElementsByClassName(`canvas-context-container-${imageData['name']}`);
        wrapper.appendChild(canvasInstance.html());
        // canvasInstance.grid.setAttribute('display', 'none')
        // console.log("🤡 ~ file: context-image-canvas.tsx ~ line 26 ~ useEffect ~ wrapper", wrapper)
        let grid = canvasInstance.gridSVGElement;
        grid.setAttribute('display', 'none');

        const img = new Image(imageData['size'][1], imageData['size'][0]);
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
            if (frameData !== null && canvasInstance) {
                canvasInstance.setup(
                    frameData,
                    [],
                    0,
                );
            }
        }
    }, [])

    return (
        <div className={`canvas-context-container-${imageData['name']}`}
            style={{
                overflow: 'hidden',
                width: '100%',
                height: 200,
            }}
        />
    );
}

export default React.memo(ContextImageCanvas);
