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
import contextImageCanvas from './context-image-canvas';
import ContextImageCanvas from './context-image-canvas';

const NUM_CANVAS_INSTANCES = 8;
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

    useEffect(() => {
        if (requested) {
            setRequested(false);
        }
    }, [frame, contextImageData]);

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
            {contextImageData && contextImageData.map((imageData: any, index: number) =>
                <ContextImageCanvas imageData={imageData} />
            )
            }
            {/* {contextImageData && contextImageData.map((imageData: any, index: number) =>
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
            } */}
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
