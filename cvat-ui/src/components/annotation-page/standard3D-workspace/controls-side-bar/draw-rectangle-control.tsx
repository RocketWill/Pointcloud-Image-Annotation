// Copyright (C) 2020-2021 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import Popover from 'antd/lib/popover';
import Icon from '@ant-design/icons';

import { Canvas } from 'cvat-canvas-wrapper';
import { RectangleIcon } from 'icons';
import { ShapeType } from 'reducers/interfaces';

import DrawShapePopoverContainer from 'containers/annotation-page/standard3D-workspace/controls-side-bar/draw-shape-popover';
import withVisibilityHandling from './handle-popover-visibility';

export interface Props {
    canvasInstance: Canvas;
    canvasInstanceSelection: Canvas;
    isDrawing: boolean;
    disabled?: boolean;
}

const CustomPopover = withVisibilityHandling(Popover, 'draw-rectangle');
function DrawRectangleControl(props: Props): JSX.Element {
    const { canvasInstance, canvasInstanceSelection, isDrawing, disabled } = props;
    const dynamicPopoverProps = isDrawing ? {
        overlayStyle: {
            display: 'none',
        },
    } : {};

    const dynamicIconProps = isDrawing ? {
        className: 'cvat-draw-rectangle-control cvat-active-canvas-control',
        onClick: (): void => {
            canvasInstanceSelection.draw({ enabled: false });
        },
    } : {
        className: 'cvat-draw-rectangle-control',
    };

    return disabled ? (
        <Icon className='cvat-draw-rectangle-control cvat-disabled-canvas-control' component={RectangleIcon} />
    ) : (
        <CustomPopover
            {...dynamicPopoverProps}
            overlayClassName='cvat-draw-shape-popover'
            placement='right'
            content={<DrawShapePopoverContainer shapeType={ShapeType.RECTANGLE} />}
        >
            <Icon {...dynamicIconProps} component={RectangleIcon} />
        </CustomPopover>
    );
}

export default React.memo(DrawRectangleControl);
