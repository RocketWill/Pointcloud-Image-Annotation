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
import CVATTooltip from 'components/common/cvat-tooltip';

const { Text } = Typography;

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

function ContextImage(): JSX.Element | null {
    const dispatch = useDispatch();
    const { number: frame, hasRelatedContext } = useSelector((state: CombinedState) => state.annotation.player.frame);
    const { data: contextImageData, hidden: contextImageHidden, fetching: contextImageFetching } = useSelector(
        (state: CombinedState) => state.annotation.player.contextImage,
    );
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
            for (let i=0; i<canvasRef.current.length; i++) {
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
    }, [contextImageData]);

    useEffect(() => {
        setTimeout(() => {
            setSvgContent(
                {
                    0: [<rect width={100} height={100} style={{fill: 'rgb(90,12,255)'}} />],
                    1: [<rect width={100} height={100} style={{fill: 'rgb(123,50,25)'}} />],
                    2: [<rect width={100} height={100} style={{fill: 'rgb(255,0,255)'}} />],
                    3: [<rect width={100} height={100} style={{fill: 'rgb(0,255,255)'}} />]
                }
            )
        }, 8000)
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
                                style={{ position: 'absolute', left: 0, top: 0, zIndex: 2}}
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