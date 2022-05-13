/*
 * @Date: 2022-03-24 11:16:25
 * @Company: Luokung Technology Corp.
 * @LastEditors: Will Cheng Yong
 * @LastEditTime: 2022-04-09 09:50:06
 */
// Copyright (C) 2021 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useState } from 'react';
import notification from 'antd/lib/notification';
import { useDispatch, useSelector } from 'react-redux';
import { QuestionCircleOutlined, ShrinkOutlined } from '@ant-design/icons';
import Spin from 'antd/lib/spin';
import Typography from 'antd/lib/typography';
import Tag from 'antd/lib/tag';
import Empty from 'antd/lib/empty';

import { CombinedState } from 'reducers/interfaces';
import { hideShowContextImage, getContextImageAsync, getCameraParamAsync } from 'actions/annotation-actions';
import CVATTooltip from 'components/common/cvat-tooltip';
import ContextImageCanvas, { ImageData } from './context-image-canvas';
import CanvasWrapperContextContainer from 'containers/annotation-page/canvas/canvas-context';
import { wrapPsrToXyz, wrapPoints3dHomoToImage2d } from './box-ops';
import createModule from "./boxOps.mjs";

const { Text } = Typography;

interface TargetInContextInfo {
    activeID: number;
    imageNames: string[];
}

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

function TargetInContextCalculation({ contextNames, targetContextInfo }:
    { contextNames: string[], targetContextInfo: TargetInContextInfo }): JSX.Element | null {
     const element = contextNames.map((contextName: string, index: number) =>
        targetContextInfo.imageNames.includes(contextName) ?
            <Tag color='#108ee9' key={`target-calculation-${contextName}`}>{index + 1}</Tag> : // blue background
            <Tag color='default' key={`target-calculation-${contextName}`}>{index + 1}</Tag>   // gray background
     )
     return (
        <div style={{ padding: 10 }}>
            <Text type='secondary'>
                {targetContextInfo.activeID > 0 ? `当前选中目标 [id-${targetContextInfo.activeID}] 有 ${targetContextInfo.imageNames.length} 张对应图像` : `无选中目标`}
            </Text>
            <div style={{ marginTop: 5 }}>{element}</div>
        </div>
    );
}

function ContextImage(): JSX.Element | null {
    const dispatch = useDispatch();
    const { number: frame, hasRelatedContext } = useSelector((state: CombinedState) => state.annotation.player.frame);
    const { data: contextImageData, hidden: contextImageHidden, fetching: contextImageFetching } = useSelector(
        (state: CombinedState) => state.annotation.player.contextImage,
    );
    const { annotations: { activatedStateID }, player: { cameraParam: allCameraParam } }
            = useSelector((state: CombinedState) => state.annotation);

    const [requested, setRequested] = useState(false);
    const [targetInContext, setTargetInContext] = useState({ activeID: -1, imageNames: [] } as TargetInContextInfo);
    const [psrToXyz, setPsrToXyz] = useState(null);
    const [points3dHomoToImage2d, setPoints3dHomoToImage2d] = useState(null);

    const calculateTargetInContext = (clientID: number, imageName: string): void => {
        setTargetInContext({
            activeID: clientID,
            imageNames: clientID === targetInContext.activeID ? [...targetInContext.imageNames, imageName] : [imageName]
        })
    }

    useEffect(() => {
        createModule().then((Module: any) => {
            setPsrToXyz(() => wrapPsrToXyz(Module));
            setPoints3dHomoToImage2d(() => wrapPoints3dHomoToImage2d(Module));
        });
    }, []);

    useEffect(() => {
        if (requested) {
            setRequested(false);
        }
    }, [frame, contextImageData]);

    useEffect(() => {
        if (hasRelatedContext && !contextImageHidden && !requested) {
            dispatch(getContextImageAsync());
            dispatch(getCameraParamAsync());
            setRequested(true);
        }
    }, [contextImageHidden, requested, hasRelatedContext]);

    // if (!hasRelatedContext) {
    //     return null;
    // }


    return (
        <div style={{ height: '100%', overflow: 'scroll' }}>
            {contextImageFetching ?
                <Spin
                    size='large'
                    style={{ display: 'flex', height: '100%',
                             justifyContent: 'center', alignItems: 'center' }}
                />
                : null
            }
            {contextImageData === null &&
                <div style={{ display: 'flex', height: '100%',
                              justifyContent: 'center', alignItems: 'center' }}>
                    <Empty />
                </div>

            }
            {contextImageData &&
                allCameraParam?.data ? (
                    <div>
                        <TargetInContextCalculation
                            contextNames={Object.keys(contextImageData)}
                            targetContextInfo={
                                activatedStateID ? targetInContext : { activeID: -1, imageNames: [] }
                            }
                        />
                    </div>
                )
                : (
                    <Text type='secondary' style={{ display: 'flex', justifyContent: 'center' }}>
                        未找到相机参数
                    </Text>
                )
            }
            {/* {contextImageData && Object.keys(contextImageData).map((imageName: string) =>
                <ContextImageCanvas
                    imageData={contextImageData[imageName]}
                    imageName={imageName}
                    calculateTargetInContext={calculateTargetInContext}
                    key={`ctx-img-canvas-${contextImageData[imageName].name}`}
                />
            )
            } */}
            {contextImageData && psrToXyz && points3dHomoToImage2d &&
                Object.keys(contextImageData).map((imageName: string, contextIndex: number) =>
                    <CanvasWrapperContextContainer
                        imageData={contextImageData[imageName]}
                        imageName={imageName}
                        contextIndex={contextIndex}
                        boxOps={{psrToXyz, points3dHomoToImage2d}}
                        key={`ctx-img-canvas-${contextImageData[imageName].name}`}
                        contextFrameData={null}
                    />
            )
            }
        </div>
    );
}

export default React.memo(ContextImage);
