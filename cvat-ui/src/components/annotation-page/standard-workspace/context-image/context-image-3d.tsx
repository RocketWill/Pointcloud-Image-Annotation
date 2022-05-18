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
import Spin from 'antd/lib/spin';
import Typography from 'antd/lib/typography';
import Tag from 'antd/lib/tag';
import Empty from 'antd/lib/empty';

import { CombinedState } from 'reducers/interfaces';
import { getContextImageAsync, getCameraParamAsync } from 'actions/annotation-actions';
import CVATTooltip from 'components/common/cvat-tooltip';
import CanvasWrapperContextContainer from 'containers/annotation-page/canvas/canvas-context';
import { wrapPsrToXyz, wrapPoints3dHomoToImage2d } from 'utils/box-operations/box-operations';
import createModule from "utils/box-operations/box-operations.mjs";

const { Text } = Typography;


function ActiveObjectStatistics({ contextNames, activatedStateID, projectionStates }:
    { contextNames: string[], activatedStateID: null | number, projectionStates: any[] }): JSX.Element | null {
        const activeProjStates = projectionStates.filter((projAnno: any) => projAnno.clientID === activatedStateID);
        const activeProjContextIndices = activeProjStates.map((projAnno: any) => projAnno.contextIndex);
        const element = contextNames.map((contextName: string, contextIndex: number) =>
        activeProjContextIndices.includes(contextIndex)
            ? <Tag color='#108ee9' key={`target-calculation-${contextName}`}>{contextIndex + 1}</Tag>
            : <Tag color='default' key={`target-calculation-${contextName}`}>{contextIndex + 1}</Tag>   // gray background
        )
     return (
        <div style={{ padding: 10 }}>
            <div>
                {activeProjStates.length > 0
                    ? <div>当前选中目标 <Tag color={activeProjStates[0].label.color}>{activatedStateID}</Tag>有 {activeProjStates.length} 张对应图像</div>
                    : `无选中目标`
                }
            </div>
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
    const { annotations: { activatedStateID, projectionStates }, player: { cameraParam: allCameraParam } }
            = useSelector((state: CombinedState) => state.annotation);

    const [requested, setRequested] = useState(false);
    const [psrToXyz, setPsrToXyz] = useState(null);
    const [points3dHomoToImage2d, setPoints3dHomoToImage2d] = useState(null);

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
                        <ActiveObjectStatistics
                            contextNames={Object.keys(contextImageData)}
                            activatedStateID={activatedStateID}
                            projectionStates={projectionStates}
                        />
                    </div>
                )
                : (
                    <Text type='secondary' style={{ display: 'flex', justifyContent: 'center' }}>
                        未找到相机参数
                    </Text>
                )
            }
            {contextImageData && psrToXyz && points3dHomoToImage2d &&
                Object.keys(contextImageData).map((imageName: string, contextIndex: number) =>
                    <CanvasWrapperContextContainer
                        imageData={contextImageData[imageName]}
                        imageName={imageName}
                        contextIndex={contextIndex}
                        boxOps={{psrToXyz, points3dHomoToImage2d}}
                        key={`ctx-img-canvas-${contextImageData[imageName].name}`}
                    />
            )
            }
        </div>
    );
}

export default React.memo(ContextImage);
