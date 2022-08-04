// Copyright (C) 2021 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React, {
    ReactElement, SyntheticEvent, useEffect, useReducer, useRef, useState
} from 'react';
// import Layout from 'antd/lib/layout/layout';
import {
    ArrowDownOutlined, ArrowLeftOutlined, ArrowRightOutlined, ArrowUpOutlined,
    VerticalAlignTopOutlined, RotateRightOutlined, ExpandAltOutlined,
    AimOutlined
} from '@ant-design/icons';
import { Layout, Row, Col, Button, Radio, Space } from 'antd';
import { ResizableBox } from 'react-resizable';
import {
    ColorBy, ContextMenuType, ObjectType, ShapeType, Workspace,
} from 'reducers/interfaces';
import {
    CameraAction, Canvas3d, ViewType, ViewsDOM,
} from 'cvat-canvas3d-wrapper';
import { Canvas, RectDrawingMethod } from 'cvat-canvas-wrapper';
import ContextImage from 'components/annotation-page/standard-workspace/context-image/context-image-3d';
import CVATTooltip from 'components/common/cvat-tooltip';
import { LogType } from 'cvat-logger';
import getCore from 'cvat-core-wrapper';

import { IoAdd, IoRemove } from 'react-icons/io5';
import { TbLayersIntersect2 } from 'react-icons/tb';
import { CuboidDrawingMethod } from 'cvat-canvas/src/typescript/canvasModel';

const cvat = getCore();

interface Props {
    opacity: number;
    selectedOpacity: number;
    outlined: boolean;
    outlineColor: string;
    colorBy: ColorBy;
    frameFetching: boolean;
    canvasInstance: Canvas3d | Canvas;
    canvasInstanceSelection: Canvas;
    jobInstance: any;
    frameData: any;
    curZLayer: number;
    annotations: any[];
    contextMenuVisibility: boolean;
    activeLabelID: number;
    activatedStateID: number | null;
    activeObjectType: ObjectType;
    onSetupCanvas: () => void;
    onGroupObjects: (enabled: boolean) => void;
    onResetCanvas(): void;
    onCreateAnnotations(sessionInstance: any, frame: number, states: any[]): void;
    onActivateObject(activatedStateID: number | null): void;
    onUpdateAnnotations(states: any[], fitPoints: Boolean): void;
    onUpdateContextMenu(visible: boolean, left: number, top: number, type: ContextMenuType, pointID?: number): void;
    onGroupAnnotations(sessionInstance: any, frame: number, states: any[]): void;
    onEditShape: (enabled: boolean) => void;
    onDragCanvas: (enabled: boolean) => void;
    onShapeDrawn: () => void;
    onDrawStart: (
        shapeType: ShapeType.POLYGON,
        labelID: number,
        objectType: ObjectType,
        points?: number,
        rectDrawingMethod?: RectDrawingMethod,
        cuboidDrawingMethod?: CuboidDrawingMethod
    ) => void;
    workspace: Workspace;
    automaticBordering: boolean;
    showObjectsTextAlways: boolean;
    frame: number;
}

interface ViewSize {
    fullHeight: number;
    fullWidth: number;
    vertical: number;
    top: number;
    side: number;
    front: number;
}

function viewSizeReducer(
    state: ViewSize,
    action: { type: ViewType | 'set' | 'resize'; e?: SyntheticEvent; data?: ViewSize },
): ViewSize {
    const event = (action.e as unknown) as MouseEvent;
    const canvas3dContainer = document.getElementById('canvas3d-container');
    if (canvas3dContainer) {
        switch (action.type) {
            case ViewType.TOP: {
                const width = event.clientX - canvas3dContainer.getBoundingClientRect().left;
                const topWidth = state.top;
                if (topWidth < width) {
                    const top = state.top + (width - topWidth);
                    const side = state.side - (width - topWidth);
                    return {
                        ...state,
                        top,
                        side,
                    };
                }
                const top = state.top - (topWidth - width);
                const side = state.side + (topWidth - width);
                return {
                    ...state,
                    top,
                    side,
                };
            }
            case ViewType.SIDE: {
                const width = event.clientX - canvas3dContainer.getBoundingClientRect().left;
                const topSideWidth = state.top + state.side;
                if (topSideWidth < width) {
                    const side = state.side + (width - topSideWidth);
                    const front = state.front - (width - topSideWidth);
                    return {
                        ...state,
                        side,
                        front,
                    };
                }
                const side = state.side - (topSideWidth - width);
                const front = state.front + (topSideWidth - width);
                return {
                    ...state,
                    side,
                    front,
                };
            }
            case ViewType.PERSPECTIVE:
                return {
                    ...state,
                    vertical: event.clientY - canvas3dContainer.getBoundingClientRect().top,
                };
            case 'set':
                return action.data as ViewSize;
            case 'resize': {
                const canvasPerspectiveContainer = document.getElementById('cvat-canvas3d-perspective');
                let midState = { ...state };
                if (canvasPerspectiveContainer) {
                    if (state.fullHeight !== canvas3dContainer.clientHeight) {
                        const diff = canvas3dContainer.clientHeight - state.fullHeight;
                        midState = {
                            ...midState,
                            fullHeight: canvas3dContainer.clientHeight,
                            vertical: state.vertical + diff,
                        };
                    }
                    if (state.fullWidth !== canvasPerspectiveContainer.clientWidth) {
                        const oldWidth = state.fullWidth;
                        const width = canvasPerspectiveContainer.clientWidth;
                        midState = {
                            ...midState,
                            fullWidth: width,
                            top: (state.top / oldWidth) * width,
                            side: (state.side / oldWidth) * width,
                            front: (state.front / oldWidth) * width,
                        };
                    }
                    return midState;
                }
                return state;
            }
            default:
                throw new Error();
        }
    }
    return state;
}

const CanvasWrapperComponent = (props: Props): ReactElement => {
    const animateId = useRef(0);
    const [showSelectionModeButton, setShowSelectionModeButton] = useState(false);
    const [selectionMode, setSelectionMode] = useState(null);
    const annotationsRef = useRef([] as any[]);
    const [activatedState, setActivatedState] = useState(null as any);
    const selectionModeRef = useRef(null);
    const activatedStateIDRef: any = useRef(null);

    const [viewSize, setViewSize] = useReducer(viewSizeReducer, {
        fullHeight: 0,
        fullWidth: 0,
        vertical: 0,
        top: 0,
        side: 0,
        front: 0,
    });
    const perspectiveView = useRef<HTMLDivElement | null>(null);
    const topView = useRef<HTMLDivElement | null>(null);
    const sideView = useRef<HTMLDivElement | null>(null);
    const frontView = useRef<HTMLDivElement | null>(null);

    const {
        opacity,
        outlined,
        outlineColor,
        selectedOpacity,
        colorBy,
        contextMenuVisibility,
        frameData,
        onResetCanvas,
        onSetupCanvas,
        annotations,
        frame,
        jobInstance,
        activeLabelID,
        activatedStateID,
        activeObjectType,
        onShapeDrawn,
        onCreateAnnotations,
        frameFetching,
    } = props;
    const { canvasInstance } = props as { canvasInstance: Canvas3d };
    const { canvasInstanceSelection } = props as { canvasInstanceSelection: Canvas };

    const onCanvasSetup = (): void => {
        onSetupCanvas();
    };

    // 检测到2d polygon有新的多边形
    const onSelectShapeDrawn = (event: any) => {
        const { state, duration } = event.detail;
        const canvasInstance2DDOM = canvasInstanceSelection.html();
        if (selectionModeRef.current !== null) {
            state.clientID = Number(activatedStateIDRef.current);
            state.selectMode = selectionModeRef.current;
            canvasInstance.updateSegmentAnnotation(state);
            setSelectionMode(null);
            canvasInstance2DDOM.style.pointerEvents = 'none';
            return
        }
        state.objectType = state.objectType || activeObjectType;
        state.label = state.label || jobInstance.labels.filter((label: any) => label.id === activeLabelID)[0];
        state.occluded = state.occluded || false;
        state.frame = frame;
        if (state.shapeType === ShapeType.POLYGON) {
            canvasInstance.createConvexHull(state);
        } else if (state.shapeType === ShapeType.RECTANGLE) {
            canvasInstance.createCuboidFromRect(state);
        }

        canvasInstance2DDOM.style.pointerEvents = 'none';
    }

    // 3d 画布返回新的标注
    const onPolygonSelect = (event: any): void => {
        const { onUpdateAnnotations } = props;
        const { state, points, polygon } = event.detail;
        // canvasInstanceSelection.add2DPolygon(polygon, state);
        const canvasInstance2DDOM = canvasInstanceSelection.html();
        if (state.clientID) {  // update
            state.points = points;
            state.amountPoints = points.length;
            onUpdateAnnotations([state], false);
        } else { // create
            state.points = points;
            state.amountPoints = points.length || 0;
            state.objectType = state.objectType || activeObjectType;
            state.label = state.label || jobInstance.labels.filter((label: any) => label.id === activeLabelID)[0];
            state.occluded = state.occluded || false;
            state.frame = frame;
            state.zOrder = 0;
            const objectState = new cvat.classes.ObjectState(state);
            onCreateAnnotations(jobInstance, frame, [objectState]);
            canvasInstance2DDOM.style.pointerEvents = 'none';
            onShapeDrawn();
        }
          // add this to end drawing

        // canvasInstanceSelection.fitCanvas();
    }

    const onCanvasDragStart = (): void => {
        const { onDragCanvas } = props;
        onDragCanvas(true);
    };

    const onCanvasDragDone = (): void => {
        const { onDragCanvas } = props;
        onDragCanvas(false);
    };

    const animateCanvas = (): void => {
        canvasInstance.render();
        animateId.current = requestAnimationFrame(animateCanvas);
    };

    const updateCanvas = (): void => {
        if (frameData !== null) {
            canvasInstance.setup(
                frameData,
                annotations.filter((e) => e.objectType !== ObjectType.TAG),
            );
        }
    };

    const onCanvasCancel = (): void => {
        onResetCanvas();
    };

    const onCanvasShapeDrawn = (event: any): void => {
        if (!event.detail.continue) {
            onShapeDrawn();
        }

        const { state, duration } = event.detail;
        const isDrawnFromScratch = !state.label;
        if (isDrawnFromScratch) {
            jobInstance.logger.log(LogType.drawObject, { count: 1, duration });
        } else {
            jobInstance.logger.log(LogType.pasteObject, { count: 1, duration });
        }

        state.amountPoints = state.amountPoints || 0;
        state.objectType = state.objectType || activeObjectType;
        state.label = state.label || jobInstance.labels.filter((label: any) => label.id === activeLabelID)[0];
        state.occluded = state.occluded || false;
        state.frame = frame;
        state.zOrder = 0;
        const objectState = new cvat.classes.ObjectState(state);
        onCreateAnnotations(jobInstance, frame, [objectState]);
    };

    const onCanvasClick = (e: MouseEvent): void => {
        const { onUpdateContextMenu } = props;
        if (contextMenuVisibility) {
            onUpdateContextMenu(false, e.clientX, e.clientY, ContextMenuType.CANVAS_SHAPE);
        }
    };

    const initialSetup = (): void => {
        const canvasInstanceDOM = canvasInstance.html() as ViewsDOM;
        canvasInstanceDOM.perspective.addEventListener('canvas.setup', onCanvasSetup);
        canvasInstanceDOM.perspective.addEventListener('canvas.canceled', onCanvasCancel);
        canvasInstanceDOM.perspective.addEventListener('canvas.dragstart', onCanvasDragStart);
        canvasInstanceDOM.perspective.addEventListener('canvas.dragstop', onCanvasDragDone);
    };

    const keyControlsKeyDown = (key: KeyboardEvent): void => {
        canvasInstance.keyControls(key);
    };

    const keyControlsKeyUp = (key: KeyboardEvent): void => {
        if (key.code === 'ControlLeft') {
            canvasInstance.keyControls(key);
        }
    };

    const onCanvasShapeSelected = (event: any): void => {
        canvasInstanceSelection.clearScene();
        const { onActivateObject } = props;
        const { clientID, state, points } = event.detail;
        onActivateObject(clientID);
        canvasInstance.activate(clientID);

        if (state && points) {
            canvasInstanceSelection.add2DPolygon(points, state)
        }
    };

    const onCanvasSetupObjects = (event: any): void => {
        canvasInstanceSelection.clearScene();
    }

    const onCanvasEditDone = (event: any): void => {
        const { onEditShape, onUpdateAnnotations } = props;
        onEditShape(false);
        const { state, points, amountPoints } = event.detail;
        // to prevent updating when nothing change
        if (state.points.join(",") === points.join(",")) {
            return;
        }
        state.points = points;
        state.amountPoints = amountPoints;
        onUpdateAnnotations([state], false);
    };

    useEffect(() => {
        const canvasInstanceDOM = canvasInstance.html();
        const canvasInstance2DDOM = canvasInstanceSelection.html();
        if (
            perspectiveView &&
            perspectiveView.current &&
            topView &&
            topView.current &&
            sideView &&
            sideView.current &&
            frontView &&
            frontView.current
        ) {
            perspectiveView.current.appendChild(canvasInstanceDOM.perspective);
            perspectiveView.current.appendChild(canvasInstance2DDOM);

            topView.current.appendChild(canvasInstanceDOM.top);
            sideView.current.appendChild(canvasInstanceDOM.side);
            frontView.current.appendChild(canvasInstanceDOM.front);
            const canvas3dContainer = document.getElementById('canvas3d-container');
            if (canvas3dContainer) {
                const width = canvas3dContainer.clientWidth / 3;
                setViewSize({
                    type: 'set',
                    data: {
                        fullHeight: canvas3dContainer.clientHeight,
                        fullWidth: canvas3dContainer.clientWidth,
                        vertical: canvas3dContainer.clientHeight / 2,
                        top: width,
                        side: width,
                        front: width,
                    },
                });
            }
        }

        document.addEventListener('keydown', keyControlsKeyDown);
        document.addEventListener('keyup', keyControlsKeyUp);

        initialSetup();
        updateCanvas();
        animateCanvas();

        const canvas2d = canvasInstanceSelection.html();
        canvas2d.style.backgroundColor = 'rgba(0, 0, 0, 0)';
        canvas2d.style.position = 'absolute';
        canvas2d.style.top = '0';
        canvas2d.style.pointerEvents = 'none';
        canvas2d.style.margin = '5px 0px 0px';

        // canvas2d.style.display = 'none'
        (canvasInstanceSelection as Canvas).configure({
            creationOpacity: 0.2,
        });
        canvasInstanceSelection.fitCanvas();

        return () => {
            canvasInstanceDOM.perspective.removeEventListener('canvas.setup', onCanvasSetup);
            canvasInstanceDOM.perspective.removeEventListener('canvas.canceled', onCanvasCancel);
            canvasInstanceDOM.perspective.removeEventListener('canvas.dragstart', onCanvasDragStart);
            canvasInstanceDOM.perspective.removeEventListener('canvas.dragstop', onCanvasDragDone);
            document.removeEventListener('keydown', keyControlsKeyDown);
            document.removeEventListener('keyup', keyControlsKeyUp);
            cancelAnimationFrame(animateId.current);
        };
    }, []);

    const updateShapesView = (): void => {
        (canvasInstance as Canvas3d).configureShapes({
            opacity,
            outlined,
            outlineColor,
            selectedOpacity,
            colorBy,
        });
    };

    const onContextMenu = (event: any): void => {
        const { onUpdateContextMenu, onActivateObject } = props;
        onActivateObject(event.detail.clientID);
        onUpdateContextMenu(
            event.detail.clientID !== null,
            event.detail.clientX,
            event.detail.clientY,
            ContextMenuType.CANVAS_SHAPE,
        );
    };

    const onResize = (): void => {
        setViewSize({
            type: 'resize',
        });
    };

    const onCanvasObjectsGroupped = (event: any): void => {
        const { onGroupAnnotations, onGroupObjects } = props;

        onGroupObjects(false);

        const { states } = event.detail;
        onGroupAnnotations(jobInstance, frame, states);
    };

    useEffect(() => {
        updateShapesView();
    }, [opacity, outlined, outlineColor, selectedOpacity, colorBy]);

    useEffect(() => {
        if (activatedStateID === null) {
            setShowSelectionModeButton(false);
            return;
        }
        const clientID = Number(activatedStateID);
        const [state] = annotations.filter((annotation: any) => annotation.clientID === clientID);
        if (!state) return;
        if ([ShapeType.POLYGON].includes(state.shapeType)) {
            setShowSelectionModeButton(true);
            setSelectionMode(null);
        } else {
            setShowSelectionModeButton(false);
        }

    }, [activatedStateID])

    useEffect(() => {
        const { onDrawStart } = props;
        selectionModeRef.current = selectionMode;
        if (showSelectionModeButton === false ||
            selectionMode === null ||
            activatedStateID === null
        ) {
            return;
        }

        const clientID = Number(activatedStateID);
        const [state] = annotations.filter((annotation: any) => annotation.clientID === clientID);
        if (!state) return;

        canvasInstanceSelection.html().style.pointerEvents = 'inherit';
        canvasInstanceSelection.draw({
            enabled: false
        })
        canvasInstanceSelection.draw({
            enabled: true,
            rectDrawingMethod: RectDrawingMethod.CLASSIC,
            cuboidDrawingMethod: CuboidDrawingMethod.CLASSIC,
            shapeType: ShapeType.POLYGON,
            crosshair: true,
            customClassName: 'cvat_canvas_shape_drawing_3d_select',
        });
        // onDrawStart(ShapeType.POLYGON, 0, ObjectType.SHAPE);

    }, [selectionMode])

    useEffect(() => {
        annotationsRef.current = annotations;
        activatedStateIDRef.current = activatedStateID;
        const [state] = annotations.filter((annotation: any) =>
            annotation.clientID === activatedStateID &&
            annotation.shapeType === ShapeType.POLYGON ||
            annotation.shapeType === ShapeType.CUBOID
        )
        if (state) {
            setActivatedState(state);
        }
    }, [annotations, activatedStateID])

    useEffect(() => {
        const canvasInstanceDOM = canvasInstance.html() as ViewsDOM;
        const canvasInstance2DDOM = canvasInstanceSelection.html();
        canvasInstanceSelection.clearScene(); // 清除2D画布
        updateCanvas();
        canvasInstanceDOM.perspective.addEventListener('canvas.drawn', onCanvasShapeDrawn);
        canvasInstanceDOM.perspective.addEventListener('canvas.selected', onCanvasShapeSelected);
        canvasInstanceDOM.perspective.addEventListener('canvas.edited', onCanvasEditDone);
        canvasInstanceDOM.perspective.addEventListener('canvas.contextmenu', onContextMenu);
        canvasInstanceDOM.perspective.addEventListener('click', onCanvasClick);
        canvasInstanceDOM.perspective.addEventListener('canvas.fit', onResize);
        canvasInstanceDOM.perspective.addEventListener('canvas.groupped', onCanvasObjectsGroupped);
        canvasInstanceDOM.perspective.addEventListener('canvas.polyselect', onPolygonSelect);
        canvasInstanceDOM.perspective.addEventListener('canvas.polygonselect', onCanvasShapeSelected);
        canvasInstanceDOM.perspective.addEventListener('canvas.setupobjects', onCanvasSetupObjects);
        canvasInstance2DDOM.addEventListener('canvas.drawn', onSelectShapeDrawn);
        window.addEventListener('resize', onResize);


        return () => {
            canvasInstanceDOM.perspective.removeEventListener('canvas.drawn', onCanvasShapeDrawn);
            canvasInstanceDOM.perspective.removeEventListener('canvas.selected', onCanvasShapeSelected);
            canvasInstanceDOM.perspective.removeEventListener('canvas.edited', onCanvasEditDone);
            canvasInstanceDOM.perspective.removeEventListener('canvas.contextmenu', onContextMenu);
            canvasInstanceDOM.perspective.removeEventListener('click', onCanvasClick);
            canvasInstanceDOM.perspective.removeEventListener('canvas.fit', onResize);
            canvasInstanceDOM.perspective.removeEventListener('canvas.groupped', onCanvasObjectsGroupped);
            canvasInstanceDOM.perspective.removeEventListener('canvas.polyselect', onPolygonSelect);
            canvasInstanceDOM.perspective.removeEventListener('canvas.polygonselect', onCanvasShapeSelected);
            canvasInstanceDOM.perspective.removeEventListener('canvas.setupobjects', onCanvasSetupObjects);
            canvasInstance2DDOM.removeEventListener('canvas.drawn', onSelectShapeDrawn);
            window.removeEventListener('resize', onResize);
        };
    }, [frameData, annotations, activeLabelID, contextMenuVisibility]);

    const screenKeyControl = (code: CameraAction, altKey: boolean, shiftKey: boolean): void => {
        canvasInstance.keyControls(new KeyboardEvent('keydown', { code, altKey, shiftKey }));
    };

    const SelectionModeGroup = (): ReactElement => (
        <span className='cvat-canvas3d-perspective-selection-mode'>
            <Radio.Group size='small' value={selectionMode} onChange={e => setSelectionMode(e.target.value)}>
                <Radio.Button value="add"><IoAdd /></Radio.Button>
                <Radio.Button value="toggle"><TbLayersIntersect2 /></Radio.Button>
                <Radio.Button value="remove"><IoRemove /></Radio.Button>
            </Radio.Group>
        </span>
    )

    const ArrowGroup = (): ReactElement => (
        <span className='cvat-canvas3d-perspective-arrow-directions'>
            <CVATTooltip title='Shift+Arrow Up' placement='topRight'>
                <button
                    data-cy='arrow-up'
                    onClick={() => screenKeyControl(CameraAction.TILT_UP, false, true)}
                    type='button'
                    className='cvat-canvas3d-perspective-arrow-directions-icons-up'
                >
                    <ArrowUpOutlined className='cvat-canvas3d-perspective-arrow-directions-icons-color' />
                </button>
            </CVATTooltip>
            <br />
            <CVATTooltip title='Shift+Arrow Left' placement='topRight'>
                <button
                    onClick={() => screenKeyControl(CameraAction.ROTATE_LEFT, false, true)}
                    type='button'
                    className='cvat-canvas3d-perspective-arrow-directions-icons-bottom'
                >
                    <ArrowLeftOutlined className='cvat-canvas3d-perspective-arrow-directions-icons-color' />
                </button>
            </CVATTooltip>
            <CVATTooltip title='Shift+Arrow Bottom' placement='topRight'>
                <button
                    onClick={() => screenKeyControl(CameraAction.TILT_DOWN, false, true)}
                    type='button'
                    className='cvat-canvas3d-perspective-arrow-directions-icons-bottom'
                >
                    <ArrowDownOutlined className='cvat-canvas3d-perspective-arrow-directions-icons-color' />
                </button>
            </CVATTooltip>
            <CVATTooltip title='Shift+Arrow Right' placement='topRight'>
                <button
                    onClick={() => screenKeyControl(CameraAction.ROTATE_RIGHT, false, true)}
                    type='button'
                    className='cvat-canvas3d-perspective-arrow-directions-icons-bottom'
                >
                    <ArrowRightOutlined className='cvat-canvas3d-perspective-arrow-directions-icons-color' />
                </button>
            </CVATTooltip>
        </span>
    );

    const ThemeGroup = (): ReactElement => (
        <span className='cvat-canvas3d-perspective-themes'>
            <CVATTooltip title='default' placement='topLeft'>
                <button
                    onClick={() => canvasInstance.themeControl('default')}
                    type='button'
                    style={{
                        width: 18, height: 18, backgroundColor: '#ffffff',
                        borderRadius: 18, border: '1px solid #ffffff'
                    }}
                />
            </CVATTooltip>
            <CVATTooltip title='rainbow' placement='topLeft'>
                <button
                    onClick={() => canvasInstance.themeControl('rainbow')}
                    type='button'
                    style={{
                        width: 18, height: 18, marginLeft: 3,
                        background: 'linear-gradient(to right, rgb(30, 150, 0), rgb(255, 242, 0), rgb(255, 0, 0))',
                        borderRadius: 18, border: '1px solid #ffffff'
                    }}
                />
            </CVATTooltip>
            <CVATTooltip title='cooltowarm' placement='topLeft'>
                <button
                    onClick={() => canvasInstance.themeControl('cooltowarm')}
                    type='button'
                    style={{
                        width: 18, height: 18, marginLeft: 3,
                        background: 'linear-gradient(to right, rgb(0, 159, 255), rgb(236, 47, 75))',
                        borderRadius: 18, border: '1px solid #ffffff'
                    }}
                />
            </CVATTooltip>
            <CVATTooltip title='blackbody' placement='topLeft'>
                <button
                    onClick={() => canvasInstance.themeControl('blackbody')}
                    type='button'
                    style={{
                        width: 18, height: 18, marginLeft: 3,
                        background: 'linear-gradient(to right, rgb(176 61 30), rgb(255 248 81))',
                        borderRadius: 18, border: '1px solid #ffffff'
                    }}
                />
            </CVATTooltip>
            <CVATTooltip title='grayscale' placement='topLeft'>
                <button
                    onClick={() => canvasInstance.themeControl('grayscale')}
                    type='button'
                    style={{
                        width: 18, height: 18, marginLeft: 3,
                        background: 'linear-gradient(to right, rgb(68 68 68), rgb(177 177 177))',
                        borderRadius: 18, border: '1px solid #ffffff'
                    }}
                />
            </CVATTooltip>
            <CVATTooltip title='mindflow' placement='topLeft'>
                <button
                    onClick={() => canvasInstance.themeControl('mindflow')}
                    type='button'
                    style={{
                        width: 18, height: 18, marginLeft: 3,
                        background: 'linear-gradient(to right, rgb(249 18 224), rgb(7 28 255), rgb(64 254 19))',
                        borderRadius: 18, border: '1px solid #ffffff'
                    }}
                />
            </CVATTooltip>
        </span>
    )

    const TransformControl = (): ReactElement => (
        <span style={{ position: 'absolute', top: '30%', left: 0, padding: 5 }}>
            <Radio.Group value='large'>
                <Space direction="vertical">
                    <CVATTooltip title='close' placement='topLeft'>
                        <Button
                            size='small'
                            onClick={() => canvasInstance.transformControl('close')}
                        >
                            <AimOutlined />
                        </Button>
                    </CVATTooltip>
                    <CVATTooltip title='translate' placement='topLeft'>
                        <Button
                            size='small'
                            onClick={() => canvasInstance.transformControl('translate')}
                        >
                            <VerticalAlignTopOutlined />
                        </Button>
                    </CVATTooltip>
                    <CVATTooltip title='rotate' placement='topLeft'>
                        <Button
                            size='small'
                            onClick={() => canvasInstance.transformControl('rotate')}
                        >
                            <RotateRightOutlined />
                        </Button>
                    </CVATTooltip>
                    <CVATTooltip title='scale' placement='topLeft'>
                        <Button
                            size='small'
                            onClick={() => canvasInstance.transformControl('scale')}
                        >
                            <ExpandAltOutlined />
                        </Button>
                    </CVATTooltip>
                </Space>
            </Radio.Group>
        </span>
    )

    const ControlGroup = (): ReactElement => (
        <span className='cvat-canvas3d-perspective-directions'>
            <CVATTooltip title='Alt+U' placement='topLeft'>
                <button
                    onClick={() => screenKeyControl(CameraAction.MOVE_UP, true, false)}
                    type='button'
                    className='cvat-canvas3d-perspective-directions-icon'
                >
                    U
                </button>
            </CVATTooltip>
            <CVATTooltip title='Alt+I' placement='topLeft'>
                <button
                    onClick={() => screenKeyControl(CameraAction.ZOOM_IN, true, false)}
                    type='button'
                    className='cvat-canvas3d-perspective-directions-icon'
                >
                    I
                </button>
            </CVATTooltip>
            <CVATTooltip title='Alt+O' placement='topLeft'>
                <button
                    onClick={() => screenKeyControl(CameraAction.MOVE_DOWN, true, false)}
                    type='button'
                    className='cvat-canvas3d-perspective-directions-icon'
                >
                    O
                </button>
            </CVATTooltip>
            <br />
            <CVATTooltip title='Alt+J' placement='topLeft'>
                <button
                    onClick={() => screenKeyControl(CameraAction.MOVE_LEFT, true, false)}
                    type='button'
                    className='cvat-canvas3d-perspective-directions-icon'
                >
                    J
                </button>
            </CVATTooltip>
            <CVATTooltip title='Alt+K' placement='topLeft'>
                <button
                    onClick={() => screenKeyControl(CameraAction.ZOOM_OUT, true, false)}
                    type='button'
                    className='cvat-canvas3d-perspective-directions-icon'
                >
                    K
                </button>
            </CVATTooltip>
            <CVATTooltip title='Alt+L' placement='topLeft'>
                <button
                    onClick={() => screenKeyControl(CameraAction.MOVE_RIGHT, true, false)}
                    type='button'
                    className='cvat-canvas3d-perspective-directions-icon'
                >
                    L
                </button>
            </CVATTooltip>
        </span>
    );

    return (
        <Row style={{ width: '100%', height: '100%' }}>
            <div id='select-box' style={{
                display: 'none',
                position: 'absolute',
                border: '1px solid #55aaff',
                backgroundColor: 'rgba(75, 160, 255, 0.3)',
                zIndex: 1,
            }} />
            <Col span={6} style={{ height: '100%' }}>
                {/* <ResizableBox
                    className='cvat-resizable'
                    height={viewSize.fullHeight}
                    width={250}
                    axis='x'
                    handle={<span className='cvat-resizable-handle-vertical-side' />}
                > */}
                <ContextImage />
                {/* </ResizableBox> */}
            </Col>
            <Col span={18} >
                <Layout.Content className='cvat-canvas3d-fullsize' id='canvas3d-container'>
                    <ResizableBox
                        className='cvat-resizable'
                        width={Infinity}
                        height={viewSize.vertical}
                        // height={500}
                        axis='y'
                        handle={<span className='cvat-resizable-handle-horizontal' />}
                        onResize={(e: SyntheticEvent) => setViewSize({ type: ViewType.PERSPECTIVE, e })}
                    >
                        {frameFetching ? (
                            <svg id='cvat_canvas_loading_animation'>
                                <circle id='cvat_canvas_loading_circle' r='30' cx='50%' cy='50%' />
                            </svg>
                        ) : null}
                        <div className='cvat-canvas3d-perspective' id='cvat-canvas3d-perspective'>
                            <div className='cvat-canvas-container cvat-canvas-container-overflow' ref={perspectiveView} />
                            <ArrowGroup />
                            <ThemeGroup />
                            <TransformControl />
                            <ControlGroup />
                            {showSelectionModeButton && <SelectionModeGroup />}
                        </div>
                    </ResizableBox>
                    <div
                        className='cvat-canvas3d-orthographic-views'
                        style={{ height: viewSize.fullHeight - viewSize.vertical }}
                    >
                        <ResizableBox
                            className='cvat-resizable'
                            width={viewSize.top}
                            height={viewSize.fullHeight - viewSize.vertical}
                            axis='x'
                            handle={<span className='cvat-resizable-handle-vertical-top' />}
                            onResize={(e: SyntheticEvent) => setViewSize({ type: ViewType.TOP, e })}
                        >
                            <div className='cvat-canvas3d-orthographic-view cvat-canvas3d-topview'>
                                <div className='cvat-canvas3d-header'>TOP</div>
                                <div className='cvat-canvas3d-fullsize' ref={topView} />
                            </div>
                        </ResizableBox>
                        <ResizableBox
                            className='cvat-resizable'
                            width={viewSize.side}
                            height={viewSize.fullHeight - viewSize.vertical}
                            axis='x'
                            handle={<span className='cvat-resizable-handle-vertical-side' />}
                            onResize={(e: SyntheticEvent) => setViewSize({ type: ViewType.SIDE, e })}
                        >
                            <div className='cvat-canvas3d-orthographic-view cvat-canvas3d-sideview'>
                                <div className='cvat-canvas3d-header'>SIDE</div>
                                <div className='cvat-canvas3d-fullsize' ref={sideView} />
                            </div>
                        </ResizableBox>
                        <div
                            className='cvat-canvas3d-orthographic-view cvat-canvas3d-frontview'
                            style={{ width: viewSize.front, height: viewSize.fullHeight - viewSize.vertical }}
                        >
                            <div className='cvat-canvas3d-header'>FRONT</div>
                            <div className='cvat-canvas3d-fullsize' ref={frontView} />
                        </div>
                    </div>
                </Layout.Content>
            </Col>
        </Row>
    );
};

export default React.memo(CanvasWrapperComponent);
