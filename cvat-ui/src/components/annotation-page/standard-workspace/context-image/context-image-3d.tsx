/*
 * @Date: 2022-03-23 13:51:13
 * @Company: Luokung Technology Corp.
 * @LastEditors: Will Cheng Yong
 * @LastEditTime: 2022-03-23 22:17:19
 */
// Copyright (C) 2021 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useState } from 'react';
import notification from 'antd/lib/notification';
import { useDispatch, useSelector } from 'react-redux';
import { QuestionCircleOutlined, ShrinkOutlined } from '@ant-design/icons';
import Spin from 'antd/lib/spin';
import Image from 'antd/lib/image';
import Typography from 'antd/lib/typography';

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
            {contextImageFetching ? <Spin size='small' style={{ padding: 10 }} /> : null}
            {
                contextImageData && contextImageData.map((imageData: any, idx: number) => (
                    <div style={{ marginBottom: 10 }}>
                        <Image
                            src={"data:image/jpeg;base64," + imageData['data']}
                            key={`context-image-${idx}`}
                            style={{ padding: 2 }}
                        />
                        <div style={{ background: 'rgba(0, 0, 0, 0.05)' }}>
                            <Text style={{ fontSize: '0.8em', padding: 3 }}>
                                {imageData['name']}
                            </Text>
                        </div>
                    </div>
                ))
            }
        </div>
    );
}

export default React.memo(ContextImage);
