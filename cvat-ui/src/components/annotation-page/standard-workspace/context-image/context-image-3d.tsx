/*
 * @Date: 2022-03-24 11:16:25
 * @Company: Luokung Technology Corp.
 * @LastEditors: Will Cheng Yong
 * @LastEditTime: 2022-03-30 17:52:36
 */
// Copyright (C) 2021 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import notification from 'antd/lib/notification';
import { useDispatch, useSelector } from 'react-redux';
import { QuestionCircleOutlined, ShrinkOutlined } from '@ant-design/icons';
import Spin from 'antd/lib/spin';

import { CombinedState } from 'reducers/interfaces';
import { hideShowContextImage, getContextImageAsync, getCameraParamAsync } from 'actions/annotation-actions';
import CVATTooltip from 'components/common/cvat-tooltip';
import ContextImageCanvas, { ImageData } from './context-image-canvas';

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

    if (!hasRelatedContext) {
        return null;
    }

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
            {contextImageData && contextImageData.map((imageData: ImageData) =>
                <ContextImageCanvas
                    imageData={imageData}
                    key={`ctx-img-canvas-${imageData.name}`}
                />
            )
            }
        </div>
    );
}

export default React.memo(ContextImage);
