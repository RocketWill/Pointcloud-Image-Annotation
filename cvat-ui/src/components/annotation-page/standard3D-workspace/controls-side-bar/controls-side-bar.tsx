// Copyright (C) 2021 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import Layout from 'antd/lib/layout';
import { ActiveControl } from 'reducers/interfaces';
import { Canvas } from 'cvat-canvas-wrapper';
import { Canvas3d } from 'cvat-canvas3d-wrapper';
import MoveControl, {
    Props as MoveControlProps,
} from './move-control';
import CursorControl, {
    Props as CursorControlProps,
} from './cursor-control';
import DrawCuboidControl, {
    Props as DrawCuboidControlProps,
} from './draw-cuboid-control';
import GroupControl, {
    Props as GroupControlProps,
} from 'components/annotation-page/standard-workspace/controls-side-bar/group-control';
import GlobalHotKeys, { KeyMap } from 'utils/mousetrap-react';
import ControlVisibilityObserver from './control-visibility-observer';
import DrawPolygonControl, {
    Props as DrawPolygonControlProps,
} from './draw-polygon-control';

interface Props {
    keyMap: KeyMap;
    canvasInstance: Canvas3d;
    canvasInstanceSelection: Canvas;
    activeControl: ActiveControl;
    normalizedKeyMap: Record<string, string>;
    labels: any[];
    jobInstance: any;
    repeatDrawShape(): void;
    redrawShape(): void;
    pasteShape(): void;
    groupObjects(enabled: boolean): void;
    resetGroup(): void;
}

const ObservedCursorControl = ControlVisibilityObserver<CursorControlProps>(CursorControl);
const ObservedMoveControl = ControlVisibilityObserver<MoveControlProps>(MoveControl);
const ObservedDrawCuboidControl = ControlVisibilityObserver<DrawCuboidControlProps>(DrawCuboidControl);
const ObservedDrawPolygonControl = ControlVisibilityObserver<DrawPolygonControlProps>(DrawPolygonControl);
const ObservedGroupControl = ControlVisibilityObserver<GroupControlProps>(GroupControl);

export default function ControlsSideBarComponent(props: Props): JSX.Element {
    const {
        canvasInstance,
        canvasInstanceSelection,
        pasteShape,
        activeControl,
        normalizedKeyMap,
        keyMap,
        labels,
        redrawShape,
        repeatDrawShape,
        groupObjects,
        resetGroup,
        jobInstance,
    } = props;

    const preventDefault = (event: KeyboardEvent | undefined): void => {
        if (event) {
            event.preventDefault();
        }
    };

    let subKeyMap: any = {
        CANCEL: keyMap.CANCEL,
    };

    let handlers: any = {
        CANCEL: (event: KeyboardEvent | undefined) => {
            preventDefault(event);
            if (activeControl !== ActiveControl.CURSOR) {
                canvasInstance.cancel();
                canvasInstanceSelection.cancel();
            }
        },
    };

    if (labels.length) {
        handlers = {
            ...handlers,
            PASTE_SHAPE: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                canvasInstance.cancel();
                pasteShape();
            },
            SWITCH_DRAW_MODE: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                const drawing = [ActiveControl.DRAW_CUBOID, ActiveControl.DRAW_POLYGON].includes(activeControl);

                if (!drawing) {
                    canvasInstance.cancel();
                    canvasInstanceSelection.cancel();
                    if (event && event.shiftKey) {
                        redrawShape();
                    } else {
                        repeatDrawShape();
                    }
                } else {
                    canvasInstance.draw({ enabled: false });
                    canvasInstanceSelection.draw({ enabled: false });
                }
            },
            SWITCH_GROUP_MODE: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                const grouping = activeControl === ActiveControl.GROUP;
                if (!grouping) {
                    canvasInstance.cancel();
                }
                canvasInstance.group({ enabled: !grouping });
                groupObjects(!grouping);
            },
            RESET_GROUP: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                const grouping = activeControl === ActiveControl.GROUP;
                if (!grouping) {
                    return;
                }
                resetGroup();
                canvasInstance.group({ enabled: false });
                groupObjects(false);
            },
            MOVE_IMAGE: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                if (activeControl === ActiveControl.DRAG_CANVAS) {
                    canvasInstance.dragCanvas(false);
                    canvasInstance.cancel();
                    canvasInstanceSelection.cancel();
                } else {
                    canvasInstance.cancel();
                    canvasInstanceSelection.cancel();
                    canvasInstanceSelection.html().style.pointerEvents = 'none';
                    canvasInstance.dragCanvas(true);
                }
                canvasInstanceSelection.clearScene();
            },
        };
        subKeyMap = {
            ...subKeyMap,
            PASTE_SHAPE: keyMap.PASTE_SHAPE,
            SWITCH_DRAW_MODE: keyMap.SWITCH_DRAW_MODE,
            SWITCH_GROUP_MODE: keyMap.SWITCH_GROUP_MODE,
            RESET_GROUP: keyMap.RESET_GROUP,
            MOVE_IMAGE: keyMap.MOVE_IMAGE,
        };
    }

    return (
        <Layout.Sider className='cvat-canvas-controls-sidebar' theme='light' width={44}>
            <GlobalHotKeys keyMap={subKeyMap} handlers={handlers} />
            <ObservedCursorControl
                cursorShortkey={normalizedKeyMap.CANCEL}
                canvasInstance={canvasInstance}
                canvasInstanceSelection={canvasInstanceSelection}
                activeControl={activeControl}
            />
            <ObservedMoveControl
                canvasInstance={canvasInstance}
                canvasInstanceSelection={canvasInstanceSelection}
                activeControl={activeControl}
            />
            <ObservedDrawCuboidControl
                canvasInstance={canvasInstance}
                canvasInstanceSelection={canvasInstanceSelection}
                isDrawing={activeControl === ActiveControl.DRAW_CUBOID}
                disabled={!labels.length}
            />
            <ObservedDrawPolygonControl
                canvasInstance={canvasInstance}
                canvasInstanceSelection={canvasInstanceSelection}
                isDrawing={activeControl === ActiveControl.DRAW_POLYGON}
                disabled={!labels.length}
            />
            <ObservedGroupControl
                switchGroupShortcut={normalizedKeyMap.SWITCH_GROUP_MODE}
                resetGroupShortcut={normalizedKeyMap.RESET_GROUP}
                canvasInstance={canvasInstance}
                activeControl={activeControl}
                groupObjects={groupObjects}
                disabled={!labels.length}
                jobInstance={jobInstance}
            />
        </Layout.Sider>
    );
}
