// Copyright (C) 2021 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import notification from 'antd/lib/notification';
import { useDispatch, useSelector } from 'react-redux';
import { QuestionCircleOutlined, ShrinkOutlined } from '@ant-design/icons';
import Spin from 'antd/lib/spin';
// import Image from 'antd/lib/image';
import Typography from 'antd/lib/typography';
import Divider from 'antd/lib/divider';

import { CombinedState } from 'reducers/interfaces';
import { hideShowContextImage, getContextImageAsync } from 'actions/annotation-actions';
import { Canvas, CanvasMode } from 'cvat-canvas-wrapper';
import CVATTooltip from 'components/common/cvat-tooltip';

const Buffer = require('buffer').Buffer;
global.Buffer = Buffer; // very important
const jpeg = require('jpeg-js');
const { Text } = Typography;
const canvasInstance = new Canvas();

export function adjustContextImagePosition(sidebarCollapsed: boolean): void {
    const element = window.document.getElementsByClassName('cvat-context-image-wrapper')[0] as
        | HTMLDivElement
        | undefined;
    if (element) {
        if (sidebarCollapsed) {
            element.style.right = '40px';
        } else {
            element.style.right = '';
        }
    }
}

function getRenderSize(originSize: number[], targetWidth: number = 250): number[] {
    const ratio = targetWidth / originSize[0];
    const targetHeight = originSize[1] * ratio;
    return [targetWidth, Math.round(targetHeight)];
}

function ContextImage(): JSX.Element | null {
    const dispatch = useDispatch();
    const { number: frame, hasRelatedContext } = useSelector((state: CombinedState) => state.annotation.player.frame);
    const { data: contextImageData, hidden: contextImageHidden, fetching: contextImageFetching } = useSelector(
        (state: CombinedState) => state.annotation.player.contextImage,
    );
    const state = useSelector((state: CombinedState) => state);

    const [requested, setRequested] = useState(false);
    const [loading, setLoading] = useState(true);
    const [svgContent, setSvgContent] = useState({} as any);
    const canvasRef = useRef([]);
    const svgRef = useRef([]);

    useEffect(() => {
        if (requested) {
            setRequested(false);
        }
    }, [frame, contextImageData]);

    useEffect(() => {
        setLoading(true)
        if (contextImageData && canvasRef.current.length === contextImageData.length) {
            for (let i = 0; i < canvasRef.current.length; i++) {
                const ctx = canvasRef.current[i].getContext('2d');
                const img = new Image(contextImageData[i]['size'][1], contextImageData[i]['size'][0]);
                const base64String = 'data:image/jpeg;base64,' + contextImageData[i]['data'];
                img.src = base64String;
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, canvasRef.current[i].width, canvasRef.current[i].height);
                }
            }
            setLoading(false);
        }
        if (contextImageData) {
            canvasInstance.configure({
                smoothImage: true,
                autoborders: false,
                undefinedAttrValue: '__undefined__',
                displayAllText: false,
                forceDisableEditing: false,
                intelligentPolygonCrop: false,
                showProjections: false,
                creationOpacity: 0.5,
                textFontSize: 12,
                textPosition: 'auto',
                textContent: undefined,
            });
            const gridElement = window.document.getElementById('cvat_canvas_grid');
            if (gridElement) {
                gridElement.style.display = 'none';
            }
            const frameData = { ...state.annotation.player.frame };
            const jpegData = Buffer.from(contextImageData[0]['data'], 'base64');
            const rawImageData = jpeg.decode(jpegData);
            const clampedArray = new Uint8ClampedArray(rawImageData.data.length);
            // manually fill Uint8ClampedArray, cause Uint8ClampedArray.from function is not available in react-native
            for (let i = 0; i < rawImageData.data.length; i++) {
                clampedArray[i] = rawImageData.data[i];
            }

            const img = new Image(contextImageData[0]['size'][1], contextImageData[0]['size'][0]);
            const base64String = 'data:image/jpeg;base64,' + contextImageData[0]['data'];
            img.src = base64String;
            img.onload = () => {
                frameData['data'] = async () => (
                    {
                        renderWidth: contextImageData[0]['size'][1],
                        renderHeight: contextImageData[0]['size'][0],
                        imageData: await createImageBitmap(img)
                        // imageData: await new ImageData(clampedArray, contextImageData[0]['size'][1], contextImageData[0]['size'][0])
                    }
                )
                frameData['width'] = contextImageData[0]['size'][1];
                frameData['height'] = contextImageData[0]['size'][0];
                // const loadingAnimation = window.document.getElementById('cvat_canvas_loading_animation');
                // loadingAnimation.classList.add('cvat_canvas_hidden');
                if (frameData !== null && canvasInstance) {
                    canvasInstance.setup(
                        frameData,
                        [],
                        0,
                    );
                    canvasInstance.fit();
                }
            }

            // window.createImageBitmap(img, 0, 0, contextImageData[0]['size'][1], contextImageData[0]['size'][0])
            //     .then(res => {
            //     console.log("🤡 ~ file: context-image-3d.tsx ~ line 87 ~ useEffect ~ res", res)
            //         // const testImage = {
            //         //     renderWidth: contextImageData[0]['size'][1],
            //         //     renderHeight: contextImageData[0]['size'][0],
            //         //     imageData: res
            //         // }
            //         // frameData['data'] = () => new Promise((resolve, reject) => resolve(testImage))
            //         // const loadingAnimation = window.document.getElementById('cvat_canvas_loading_animation');
            //         // loadingAnimation.classList.add('cvat_canvas_hidden');
            //         // if (frameData !== null && canvasInstance) {
            //         //     canvasInstance.setup(
            //         //         frameData,
            //         //         [],
            //         //         200,
            //         //     );
            //         // }
            //     })
            // const testImage = {
            //     renderWidth: contextImageData[0]['size'][1],
            //     renderHeight: contextImageData[0]['size'][0],
            //     imageData: window.createImageBitmap(img)
            //     // imageData: img
            // }
            // console.log("🤡 ~ file: context-image-3d.tsx ~ line 89 ~ useEffect ~ window.createImageBitmap(img)", window.createImageBitmap(img))
            // frameData['data'] = () => new Promise((resolve, reject) => resolve(testImage))
            // const loadingAnimation = window.document.getElementById('cvat_canvas_loading_animation');
            // loadingAnimation.classList.add('cvat_canvas_hidden');
            // if (frameData !== null && canvasInstance) {
            //     canvasInstance.setup(
            //         frameData,
            //         [],
            //         200,
            //     );
            // }
        }


    }, [contextImageData]);

    useEffect(() => {
        const [wrapper] = window.document.getElementsByClassName('canvas-test');
        wrapper.appendChild(canvasInstance.html());

        // setTimeout(() => {
        //     setSvgContent(
        //         {
        //             0: [<rect width={100} height={100} style={{ fill: 'rgb(90,12,255)' }} />],
        //             1: [<rect width={100} height={100} style={{ fill: 'rgb(123,50,25)' }} />],
        //             2: [<rect width={100} height={100} style={{ fill: 'rgb(255,0,255)' }} />],
        //             3: [<rect width={100} height={100} style={{ fill: 'rgb(0,255,255)' }} />]
        //         }
        //     )
        // }, 8000)
    }, [])

    useEffect(() => {
        if (hasRelatedContext && !contextImageHidden && !requested) {
            dispatch(getContextImageAsync());
            setRequested(true);
        }
    }, [contextImageHidden, requested, hasRelatedContext]);

    if (!hasRelatedContext) {
        return null;
    }

    return (
        <div>
            {loading ? <Spin size='small' style={{ padding: 10 }} /> : null}
            <div
                className='canvas-test'
                style={{
                    overflow: 'hidden',
                    width: '100%',
                    height: 200,
                }}
            />
            {contextImageData && contextImageData.map((imageData: any, index: number) =>
                <>
                    <div style={{ position: 'relative' }}>
                        <canvas
                            ref={el => canvasRef.current[index] = el}
                            id={imageData['name']}
                            width={250}
                            key={`canvas-${imageData['name']}`}
                        />
                        <svg
                            ref={el => svgRef.current[index] = el}
                            width={250}
                            key={`svg-${imageData['name']}`}
                            style={{ position: 'absolute', left: 0, top: 0, zIndex: 2 }}
                        >
                            {svgContent ? svgContent[index] : null}
                        </svg>
                    </div>
                    <div
                        style={{ background: 'rgba(0, 0, 0, 0.05)', marginTop: -5, marginBottom: 10 }}
                        key={`desp-${imageData['name']}`}
                    >
                        <Text style={{ fontSize: '0.8em', padding: 5 }}>
                            {imageData['name']}
                        </Text>
                    </div>
                </>
            )
            }
            {!loading &&
                <Divider>
                    <Text
                        style={{ fontSize: '0.8em', color: 'rgba(0, 0, 0, 0.85)' }}
                    >
                        end
                    </Text>
                </Divider>
            }
        </div>
    );
}

export default React.memo(ContextImage);
