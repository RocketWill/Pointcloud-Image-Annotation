// Copyright (C) 2020-2021 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import Popover from 'antd/lib/popover';
import Icon from '@ant-design/icons';

import { Canvas } from 'cvat-canvas-wrapper';
import { Canvas3d } from 'cvat-canvas3d/src/typescript/canvas3d';
import { PolygonIcon } from 'icons';
import { ShapeType } from 'reducers/interfaces';

import DrawShapePopoverContainer from 'containers/annotation-page/standard3D-workspace/controls-side-bar/draw-shape-popover';
import withVisibilityHandling from './handle-popover-visibility';

export interface Props {
    canvasInstance: Canvas3d;
    canvasInstanceSelection: Canvas;
    isDrawing: boolean;
    disabled?: boolean;
}

const CustomPopover = withVisibilityHandling(Popover, 'draw-polygon');
function DrawPolygonControl(props: Props): JSX.Element {
    const { canvasInstance, canvasInstanceSelection, isDrawing, disabled } = props;
    // 显示点云分割投影多边形
    const dynamicPopoverProps = isDrawing ? {
        overlayStyle: {
            display: 'none',
        },
    } : {};

    const dynamicIconProps = isDrawing ? {
        className: 'cvat-draw-polygon-control cvat-active-canvas-control',
        onClick: (): void => {
            canvasInstanceSelection.draw({ enabled: false });
        },
    } : {
        className: 'cvat-draw-polygon-control',
    };

    return disabled ? (
        <Icon className='cvat-draw-polygon-control cvat-disabled-canvas-control' component={PolygonIcon} />
    ) : (
        <CustomPopover
            {...dynamicPopoverProps}
            overlayClassName='cvat-draw-shape-popover'
            placement='right'
            content={<DrawShapePopoverContainer shapeType={ShapeType.POLYGON} />}
        >
            <Icon {...dynamicIconProps} component={PolygonIcon} />
        </CustomPopover>
    );
}

export default React.memo(DrawPolygonControl);
