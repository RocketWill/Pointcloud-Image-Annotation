/*
 * @Date: 2022-04-08 16:01:25
 * @Company: Luokung Technology Corp.
 * @LastEditors: Will Cheng
 * @LastEditTime: 2022-04-18 15:10:17
 */
import './styles.scss';
import React, {
    ReactElement, useEffect, useRef, useMemo, useState
} from 'react';
import { usePrevious } from 'utils/hooks';
import Typography from 'antd/lib/typography';
import Tag from 'antd/lib/tag';
import Popover from 'antd/lib/popover';
import Select from 'antd/lib/select';
import Button from 'antd/lib/button';
import notification from 'antd/lib/notification';
import GlobalHotKeys, { KeyMap } from 'utils/mousetrap-react';
import {
    ColorBy, GridColor, ObjectType, ContextMenuType, Workspace, ShapeType,
} from 'reducers/interfaces';
import { LogType } from 'cvat-logger';
import { Canvas } from 'cvat-canvas-wrapper';
import { Canvas3d } from 'cvat-canvas3d-wrapper';
import getCore from 'cvat-core-wrapper';
import consts from 'consts';
import CVATTooltip from 'components/common/cvat-tooltip';
import { Calib } from 'utils/box-operations/box-operations'

import { BsBox, BsBoundingBoxCircles } from 'react-icons/bs';
import { RiEyeCloseLine } from 'react-icons/ri';
import { MdOutlineFilterCenterFocus } from 'react-icons/md';
import { HiOutlineDuplicate } from 'react-icons/hi';

const cvat = getCore();
const MAX_DISTANCE_TO_OPEN_SHAPE = 50;
const { Paragraph } = Typography;
const { Option } = Select;

interface Props {
    sidebarCollapsed: boolean;
    canvasInstance: Canvas | Canvas3d | null;
    jobInstance: any;
    activatedStateID: number | null;
    activatedAttributeID: number | null;
    annotations: any[];
    latestAnnotation: any;
    removedAnnotation: any;
    projectionAnnotations: any;
    frameData: any;
    frameAngle: number;
    frameFetching: boolean;
    frame: number;
    opacity: number;
    colorBy: ColorBy;
    selectedOpacity: number;
    outlined: boolean;
    outlineColor: string;
    showBitmap: boolean;
    showProjections: boolean;
    grid: boolean;
    gridSize: number;
    gridColor: GridColor;
    gridOpacity: number;
    activeLabelID: number;
    activeObjectType: ObjectType;
    curZLayer: number;
    minZLayer: number;
    maxZLayer: number;
    brightnessLevel: number;
    contrastLevel: number;
    saturationLevel: number;
    resetZoom: boolean;
    smoothImage: boolean;
    aamZoomMargin: number;
    showObjectsTextAlways: boolean;
    textFontSize: number;
    textPosition: 'auto' | 'center';
    textContent: string;
    showAllInterpolationTracks: boolean;
    workspace: Workspace;
    automaticBordering: boolean;
    intelligentPolygonCrop: boolean;
    keyMap: KeyMap;
    canvasBackgroundColor: string;
    switchableAutomaticBordering: boolean;
    cameraParam: any;
    imageData: any;
    imageName: string;
    contextIndex: number;
    psrToXyz: Function;
    points3dHomoToImage2d: Function;

    onSetupCanvas: () => void;
    onDragCanvas: (enabled: boolean) => void;
    onZoomCanvas: (enabled: boolean) => void;
    onMergeObjects: (enabled: boolean) => void;
    onGroupObjects: (enabled: boolean) => void;
    onSplitTrack: (enabled: boolean) => void;
    onEditShape: (enabled: boolean) => void;
    onShapeDrawn: () => void;
    onResetCanvas: () => void;
    onUpdateAnnotations(states: any[]): void;
    onUpdateProjectionAnnotations(states: any[], height_: number | null, width_: number | null): void;
    onCreateAnnotations(sessionInstance: any, frame: number, states: any[]): void;
    onCreateProjectionAnnotations(sessionInstance: any, frame: number, projectionIndexStates: any[], contextIndex: number): void;
    onMergeAnnotations(sessionInstance: any, frame: number, states: any[]): void;
    onGroupAnnotations(sessionInstance: any, frame: number, states: any[]): void;
    onSplitAnnotations(sessionInstance: any, frame: number, state: any): void;
    onActivateObject(activatedStateID: number | null): void;
    onUpdateContextMenu(visible: boolean, left: number, top: number, type: ContextMenuType, pointID?: number): void;
    onAddZLayer(): void;
    onSwitchZLayer(cur: number): void;
    onChangeBrightnessLevel(level: number): void;
    onChangeContrastLevel(level: number): void;
    onChangeSaturationLevel(level: number): void;
    onChangeGridOpacity(opacity: number): void;
    onChangeGridColor(color: GridColor): void;
    onSwitchGrid(enabled: boolean): void;
    onSwitchAutomaticBordering(enabled: boolean): void;
    onFetchAnnotation(): void;
    onGetDataFailed(error: any): void;
    onStartIssue(position: number[]): void;
    removeObject: (sessionInstance: any, objectState: any) => void;
}

const CanvasWrapperContextComponent = (props: Props): ReactElement => {
    const [projFrameData, setProjFrameData] = useState(null as any);
    const [isolatedMode, setIsolatedMode] = useState(false);
    const [annosInvisibility, setAnnosInvisibility] = useState(false);
    const [showShapeType, setShowShapeType] = useState('cuboid' as 'cuboid' | 'rectangle');
    const [replicaID, serReplicaID] = useState(null as number | null);
    const projAnnosRef = useRef([] as any[]);
    const lastestAnnoRef = useRef();
    const cameraParamRef = useRef();
    const {
        opacity,
        outlined,
        outlineColor,
        colorBy,
        frame,
        annotations,
        latestAnnotation,
        removedAnnotation,
        projectionAnnotations,
        activatedStateID,
        automaticBordering,
        intelligentPolygonCrop,
        showObjectsTextAlways,
        workspace,
        showProjections,
        selectedOpacity,
        smoothImage,
        textFontSize,
        textPosition,
        textContent,
        cameraParam: allCameraParam,
        imageData,
        imageName,
        contextIndex,
        canvasInstance: canvasInstance3D,  // 3d instance
    } = props;

    const prevActivatedStateID = usePrevious(activatedStateID);
    const canvasInstance = useMemo(() => new Canvas(true), []);  // 2d instance
    const cameraParam = allCameraParam?.data?.[imageName];

    const boxTo2DPoints = (points: number[], calib: Calib) => {
        const { psrToXyz, points3dHomoToImage2d } = props;
        const position = [points[0], points[1], points[2]];
        const rotation = [points[3], points[4], points[5]];
        const scale = [points[6], points[7], points[8]];
        let box3d = psrToXyz(position, scale, rotation);
        box3d = box3d.slice(0, 8 * 4);
        const box2dPoints = points3dHomoToImage2d(box3d, calib, false, []);
        return box2dPoints;
    }

    const calProjectionCuboid = (points: number[] | null, cameraParam: any): any => {
        if (!cameraParam) {
            console.error('Camera params not found!');
            return null;
        }
        if (!points) {
            console.log("No projection get.");
            return null;
        }
        const susBox = boxTo2DPoints(points, cameraParam);
        if (susBox === null) return null;
        return [
            susBox[4], susBox[5],
            susBox[2], susBox[3],
            susBox[6], susBox[7],
            susBox[0], susBox[1],
            susBox[14], susBox[15],
            susBox[8], susBox[9],
            susBox[12], susBox[13],
            susBox[10], susBox[11]
        ]
    }

    const calProjectionRect = (points: number[] | null, imageHeight: number, imageWidth: number) => {
        if (points === null) return null;
        const xAxiasPoints = points.filter((_: number, index: number) => index % 2 === 0);
        const yAxiasPoints = points.filter((_: number, index: number) => index % 2 === 1);
        let xMin = Math.min(...xAxiasPoints);
        let xMax = Math.max(...xAxiasPoints);
        let yMin = Math.min(...yAxiasPoints);
        let yMax = Math.max(...yAxiasPoints);
        if (xMin < 0) xMin = 0;
        if (xMax > imageWidth) xMax = imageWidth;
        if (yMin < 0) yMin = 0;
        if (yMax > imageHeight) yMax = imageHeight;
        return [xMin, yMin, xMax, yMax]
    }

    const calProjectionRectAnno = (points: number[] | null, annotation: any, imageHeight: number, imageWidth: number) => {
        const rectangle = calProjectionRect(points, imageHeight, imageWidth);
        if (rectangle === null) return null;
        const annotationState = createAnnotationState(annotation, 'rectangle');
        annotationState.points = rectangle;
        return annotationState;
    }

    const calCreateProjectionCuboidAnno = (box: number | null, annotation: any, cameraParam: any): any => {
        if (box === null) {
            return null;
        }
        const annotationState = createAnnotationState(annotation, 'cuboid');
        annotationState.points = box;
        return annotationState;
    }

    const createAnnotationState = (annotation: any, shapeType: 'cuboid' | 'rectangle') => {
        const { contextIndex } = props;
        return ({
            points: annotation.points,
            color: annotation.label.color,
            clientID: annotation.clientID,
            zOrder: annotation.zOrder,
            hidden: annotation.hidden,
            outside: annotation.outside,
            occluded: annotation.occluded,
            shapeType,
            pinned: annotation.pinned,
            descriptions: annotation.descriptions,
            frame: annotation.frame,
            label: annotation.label,
            lock: annotation.lock,
            source: annotation.source,
            updated: annotation.updated,
            attributes: annotation.attributes,
            contextIndex,
            modified2d: false,
            clientProjID: annotation.clientID,
        });
    }

    const onCanvasMouseDown = (e: MouseEvent): void => {
        const { workspace, activatedStateID, onActivateObject } = props;
        if ((e.target as HTMLElement).tagName === 'svg' && e.button !== 2) {
            if (activatedStateID !== null && workspace !== Workspace.ATTRIBUTE_ANNOTATION) {
                onActivateObject(null);
            }
        }
    };

    const onCanvasClicked = (): void => {
        const { onUpdateContextMenu } = props;
        onUpdateContextMenu(false, 0, 0, ContextMenuType.CANVAS_SHAPE);
        if (!canvasInstance.html().contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    };

    const onCanvasContextMenu = (e: MouseEvent): void => {
        const { activatedStateID, onUpdateContextMenu } = props;

        if (e.target && !(e.target as HTMLElement).classList.contains('svg_select_points')) {
            onUpdateContextMenu(activatedStateID !== null, e.clientX, e.clientY, ContextMenuType.CANVAS_SHAPE);
        }
    };

    const onCanvasEditStart = (): void => {
        const { onActivateObject, onEditShape } = props;
        onActivateObject(null);
        onEditShape(true);
    };

    const onCanvasEditDone = (event: any): void => {
        const { onEditShape, onUpdateProjectionAnnotations } = props;
        const height_ = imageData['size'][0];
        const width_ = imageData['size'][1];
        onEditShape(false);
        const { state, points, rotation } = event.detail;
        state.points = points;
        state.rotation = rotation;
        onUpdateProjectionAnnotations([state], height_, width_);
    };

    const onCanvasDragStart = (): void => {
        const { onDragCanvas } = props;
        onDragCanvas(true);
    };

    const onCanvasDragDone = (): void => {
        const { onDragCanvas } = props;
        onDragCanvas(false);
    };

    const onCanvasZoomStart = (): void => {
        const { onZoomCanvas } = props;
        onZoomCanvas(true);
    };

    const onCanvasZoomDone = (): void => {
        const { onZoomCanvas } = props;
        onZoomCanvas(false);
    };

    const onCanvasSetup = (): void => {
        const { onSetupCanvas } = props;
        onSetupCanvas();
        updateShapesView();
        activateOnCanvas();
    };

    const onCanvasCancel = (): void => {
        const { onResetCanvas } = props;
        onResetCanvas();
    };

    const onCanvasFindObject = async (e: any): Promise<void> => {
        const { jobInstance } = props;
        const result = await jobInstance.annotations.select(e.detail.states, e.detail.x, e.detail.y);

        if (result && result.state) {
            if (result.state.shapeType === 'polyline' || result.state.shapeType === 'points') {
                if (result.distance > MAX_DISTANCE_TO_OPEN_SHAPE) {
                    return;
                }
            }
            canvasInstance.select(result.state);
        }
    };

    const onCanvasPointContextMenu = (e: any): void => {
        const { activatedStateID, onUpdateContextMenu, annotations } = props;

        const [state] = annotations.filter((el: any) => el.clientID === activatedStateID);
        if (![ShapeType.CUBOID, ShapeType.RECTANGLE].includes(state.shapeType)) {
            onUpdateContextMenu(
                activatedStateID !== null,
                e.detail.mouseEvent.clientX,
                e.detail.mouseEvent.clientY,
                ContextMenuType.CANVAS_SHAPE_POINT,
                e.detail.pointID,
            );
        }
    };

    const onCanvasErrorOccurrence = (event: any): void => {
        const { exception } = event.detail;
        const { onGetDataFailed } = props;
        onGetDataFailed(exception);
    };

    const onCanvasShapeDrawn = (event: any): void => {
        const {
            jobInstance, activeLabelID, activeObjectType, frame, onShapeDrawn, onCreateAnnotations,
        } = props;

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

        state.objectType = state.objectType || activeObjectType;
        state.label = state.label || jobInstance.labels.filter((label: any) => label.id === activeLabelID)[0];
        state.occluded = state.occluded || false;
        state.frame = frame;
        state.rotation = state.rotation || 0;
        const objectState = new cvat.classes.ObjectState(state);
        onCreateAnnotations(jobInstance, frame, [objectState]);
    };

    const onCanvasObjectsMerged = (event: any): void => {
        const {
            jobInstance, frame, onMergeAnnotations, onMergeObjects,
        } = props;

        onMergeObjects(false);

        const { states, duration } = event.detail;
        jobInstance.logger.log(LogType.mergeObjects, {
            duration,
            count: states.length,
        });
        onMergeAnnotations(jobInstance, frame, states);
    };

    const onCanvasObjectsGroupped = (event: any): void => {
        const {
            jobInstance, frame, onGroupAnnotations, onGroupObjects,
        } = props;

        onGroupObjects(false);

        const { states } = event.detail;
        onGroupAnnotations(jobInstance, frame, states);
    };

    const onCanvasPositionSelected = (event: any): void => {
        const { onResetCanvas, onStartIssue } = props;
        const { points } = event.detail;
        onStartIssue(points);
        onResetCanvas();
    };

    const onCanvasTrackSplitted = (event: any): void => {
        const {
            jobInstance, frame, onSplitAnnotations, onSplitTrack,
        } = props;

        onSplitTrack(false);

        const { state } = event.detail;
        onSplitAnnotations(jobInstance, frame, state);
    };

    const fitCanvas = (): void => {
        if (canvasInstance) {
            canvasInstance.fitCanvas();
        }
    };

    const activateOnCanvas = (): void => {
        const {
            activatedStateID,
            activatedAttributeID,
            selectedOpacity,
            aamZoomMargin,
            workspace,
            projectionAnnotations,
        } = props;

        if (activatedStateID !== null) {
            const [activatedState] = projectionAnnotations.filter((state: any): boolean => state.clientID === activatedStateID && state.shapeType === showShapeType);
            if (workspace === Workspace.ATTRIBUTE_ANNOTATION) {
                if (activatedState.objectType !== ObjectType.TAG) {
                    canvasInstance.focus(activatedStateID, aamZoomMargin);
                } else {
                    canvasInstance.fit();
                }
            }
            if (activatedState && activatedState.objectType !== ObjectType.TAG) {
                canvasInstance.activate(activatedStateID, activatedAttributeID);
            }
            const els = document.querySelectorAll(`#cvat_canvas_shape_${activatedStateID}`);
            for (const el of els) {
                ((el as any) as SVGElement).setAttribute('fill-opacity', `${selectedOpacity}`);
            }
        }
    }

    const updateShapesView = (): void => {
        const {
            annotations, opacity, colorBy, outlined, outlineColor,
        } = props;

        for (const state of annotations) {
            let shapeColor = '';

            if (colorBy === ColorBy.INSTANCE) {
                shapeColor = state.color;
            } else if (colorBy === ColorBy.GROUP) {
                shapeColor = state.group.color;
            } else if (colorBy === ColorBy.LABEL) {
                shapeColor = state.label.color;
            }

            // TODO: In this approach CVAT-UI know details of implementations CVAT-CANVAS (svg.js)
            // const shapeView = window.document.getElementById(`cvat_canvas_shape_${state.clientID}`);  // one state should be in only one canvas instance
            const shapeViews = document.querySelectorAll(`#cvat_canvas_shape_${state.clientID}`);
            if (shapeViews.length > 0) {
                for (const shapeView of shapeViews) {
                    if (shapeView) {
                        const handler = (shapeView as any).instance.remember('_selectHandler');
                        if (handler && handler.nested) {
                            handler.nested.fill({ color: shapeColor });
                        }

                        (shapeView as any).instance.fill({ color: shapeColor, opacity });
                        (shapeView as any).instance.stroke({ color: outlined ? outlineColor : shapeColor });
                    }
                }
            }
        }
    }

    const createProjectionAnnotations = (state3D: any) => {
        const { jobInstance, frame, contextIndex, onCreateProjectionAnnotations } = props;
        const box = calProjectionCuboid(state3D.points, cameraParam);
        const stateToCreateCuboid = calCreateProjectionCuboidAnno(box, state3D, cameraParamRef.current);
        const stateToCreateRectangle = calProjectionRectAnno(box, state3D, imageData['size'][0], imageData['size'][1]);
        if (stateToCreateCuboid !== null && stateToCreateRectangle !== null) {
            const cuboidState = new cvat.classes.ObjectState(stateToCreateCuboid);
            const rectangleState = new cvat.classes.ObjectState(stateToCreateRectangle);
            onCreateProjectionAnnotations(jobInstance, frame, [cuboidState, rectangleState], contextIndex);
        }
    }

    const onCanvas3DShapeDrawn = (e: any): void => {
        // Listen 3d shape drawn
        // We do not use this 'cause clientID was generated after creating ShapeState
    }

    const onCanvas3DEditDone = (e: any): void => {
        const { points, state } = e.detail;
        const { jobInstance, frame, contextIndex, onUpdateProjectionAnnotations, onCreateProjectionAnnotations, removeObject } = props;
        const box = calProjectionCuboid(points, cameraParamRef.current);
        const rect = calProjectionRect(box, imageData['size'][0], imageData['size'][1])
        const prevStates = projAnnosRef.current.filter((projState: any) => projState.clientID === state.clientID && contextIndex === projState.contextIndex)
        for (const prevState of prevStates) {
            prevState.label = state.label;
            prevState.color = state.color;
            prevState.zOrder = state.zOrder;
            prevState.hidden = state.hidden;
            prevState.outside = state.outside ? state.outside : false;
            prevState.occluded = state.occluded;
            prevState.pinned = state.pinned;
            prevState.descriptions = state.descriptions;
            prevState.lock = state.lock;
            prevState.attributes = state.attributes;
            prevState.modified2d = state.modified2d;
        }
        const cuboidPrevState = prevStates.filter((projState: any) => projState.shapeType === 'cuboid');
        // update Cuboid
        const rectPrevState = prevStates.filter((projState: any) => projState.shapeType === 'rectangle');
        if (cuboidPrevState.length > 0 && box !== null) {
            console.log(`Update 2D cuboid projection of Client ${state.clientID}.`);
            cuboidPrevState[0].points = box;
            onUpdateProjectionAnnotations([cuboidPrevState[0]], imageData['size'][0], imageData['size'][1]);
        }
        if (cuboidPrevState.length === 0 && box !== null) {
            // create
            const stateToCreate = createAnnotationState(state, 'cuboid');
            stateToCreate.points = box;
            onCreateProjectionAnnotations(jobInstance, frame, [new cvat.classes.ObjectState(stateToCreate)], contextIndex);
            console.log(`Create ouside 2D cuboid projection of Client ${state.clientID}.`);
        }
        if (cuboidPrevState.length !== 0 && box === null) {
            // delete
            removeObject(jobInstance, cuboidPrevState[0]);
            console.log(`Remove ouside 2D cuboid projection of Client ${state.clientID}.`);
        }

        // update Rectangle
        if (rectPrevState.length > 0 && rect !== null) {
            console.log(`Update 2D rect projection of Client ${state.clientID}.`);
            rectPrevState[0].points = rect;
            onUpdateProjectionAnnotations([rectPrevState[0]], imageData['size'][0], imageData['size'][1]);
        }
        if (rectPrevState.length === 0 && rect !== null) {
            // create
            const stateToCreate = createAnnotationState(state, 'rectangle');
            stateToCreate.points = rect;
            onCreateProjectionAnnotations(jobInstance, frame, [new cvat.classes.ObjectState(stateToCreate)], contextIndex);
            console.log(`Create ouside 2D rect projection of Client ${state.clientID}.`);
        }
        if (rectPrevState.length !== 0 && rect === null) {
            // delete
            removeObject(jobInstance, rectPrevState[0]);
            console.log(`Remove ouside 2D rect projection of Client ${state.clientID}.`);
        }
        updateShowingShapeType();
    }

    const updateCanvas = (projectionAnnotations: any[] = []): void => {
        const { contextIndex } = props;
        if (projFrameData) {
            canvasInstance.setup(
                projFrameData,
                projectionAnnotations.filter((projAnnotation: any) =>
                    projAnnotation.contextIndex === contextIndex
                ),
                0,
            );
        }
    }

    const onCanvasShapeDeactivated = (e: any): void => {
        const { onActivateObject, activatedStateID } = props;
        const { state } = e.detail;

        // when we activate element, canvas deactivates the previous
        // and triggers this event
        // in this case we do not need to update our state
        if (state.clientID === activatedStateID) {
            onActivateObject(null);
        }
    };

    const onCanvasCursorMoved = async (event: any): Promise<void> => {
        const {
            jobInstance, activatedStateID, workspace, onActivateObject,
        } = props;

        if (![Workspace.STANDARD3D, Workspace.REVIEW_WORKSPACE].includes(workspace)) {
            return;
        }

        const result = await jobInstance.annotations.selectProjection(event.detail.states, event.detail.x, event.detail.y);
        if (result && result.state) {
            if (result.state.shapeType === 'polyline' || result.state.shapeType === 'points') {
                if (result.distance > MAX_DISTANCE_TO_OPEN_SHAPE) {
                    return;
                }
            }

            if (activatedStateID !== result.state.clientID) {
                onActivateObject(result.state.clientID);
            }
        }
    };

    const onCanvasZoomChanged = (): void => {
        const { jobInstance } = props;
        jobInstance.logger.log(LogType.zoomImage);
    };

    const onCanvasImageFitted = (): void => {
        const { jobInstance } = props;
        jobInstance.logger.log(LogType.fitImage);
    };

    const onCanvasShapeDragged = (e: any): void => {
        const { jobInstance } = props;
        const { id } = e.detail;
        jobInstance.logger.log(LogType.dragObject, { id });
    };

    const onCanvasShapeResized = (e: any): void => {
        const { jobInstance } = props;
        const { id } = e.detail;
        jobInstance.logger.log(LogType.resizeObject, { id });
    };

    const onCanvasShapeClicked = (e: any): void => {
        const { clientID } = e.detail.state;
        const sidebarItem = window.document.getElementById(`cvat-objects-sidebar-state-item-${clientID}`);
        if (sidebarItem) {
            sidebarItem.scrollIntoView();
        }
    };

    const initialSetup = (): void => {
        const {
            grid,
            gridSize,
            gridColor,
            gridOpacity,
            canvasBackgroundColor,
            contextIndex,
        } = props;

        // Size
        window.addEventListener('resize', fitCanvas);
        fitCanvas();

        // Grid
        const gridElement = document.querySelectorAll<HTMLElement>('#cvat_canvas_grid')[contextIndex];
        const gridPattern = document.querySelectorAll<HTMLElement>('#cvat_canvas_grid_pattern')[contextIndex];
        if (gridElement) {
            gridElement.style.display = grid ? 'block' : 'none';
        }
        if (gridPattern) {
            gridPattern.style.stroke = gridColor.toLowerCase();
            gridPattern.style.opacity = `${gridOpacity}`;
        }
        canvasInstance.grid(gridSize, gridSize);

        const canvasWrapperElements = window.document
            .getElementsByClassName('cvat-canvas-container') as HTMLCollectionOf<HTMLElement> | null;
        if (canvasWrapperElements) {
            for (const canvasWrapperElement of canvasWrapperElements) {
                canvasWrapperElement.style.backgroundColor = canvasBackgroundColor;
            }
        }

        // Events
        canvasInstance.html().addEventListener(
            'canvas.setup',
            () => {
                const { activatedStateID, activatedAttributeID } = props;
                canvasInstance.fit();
                canvasInstance.activate(activatedStateID, activatedAttributeID);
            },
            { once: true },
        );

        canvasInstance.html().addEventListener('mousedown', onCanvasMouseDown);
        canvasInstance.html().addEventListener('click', onCanvasClicked);
        canvasInstance.html().addEventListener('contextmenu', onCanvasContextMenu);
        canvasInstance.html().addEventListener('canvas.editstart', onCanvasEditStart);
        canvasInstance.html().addEventListener('canvas.edited', onCanvasEditDone);
        canvasInstance.html().addEventListener('canvas.dragstart', onCanvasDragStart);
        canvasInstance.html().addEventListener('canvas.dragstop', onCanvasDragDone);
        canvasInstance.html().addEventListener('canvas.zoomstart', onCanvasZoomStart);
        canvasInstance.html().addEventListener('canvas.zoomstop', onCanvasZoomDone);

        canvasInstance.html().addEventListener('canvas.setup', onCanvasSetup);
        canvasInstance.html().addEventListener('canvas.canceled', onCanvasCancel);
        canvasInstance.html().addEventListener('canvas.find', onCanvasFindObject);
        canvasInstance.html().addEventListener('canvas.deactivated', onCanvasShapeDeactivated);
        canvasInstance.html().addEventListener('canvas.moved', onCanvasCursorMoved);

        canvasInstance.html().addEventListener('canvas.zoom', onCanvasZoomChanged);
        canvasInstance.html().addEventListener('canvas.fit', onCanvasImageFitted);
        canvasInstance.html().addEventListener('canvas.dragshape', onCanvasShapeDragged);
        canvasInstance.html().addEventListener('canvas.resizeshape', onCanvasShapeResized);
        canvasInstance.html().addEventListener('canvas.clicked', onCanvasShapeClicked);
        canvasInstance.html().addEventListener('canvas.drawn', onCanvasShapeDrawn);
        canvasInstance.html().addEventListener('canvas.merged', onCanvasObjectsMerged);
        canvasInstance.html().addEventListener('canvas.groupped', onCanvasObjectsGroupped);
        canvasInstance.html().addEventListener('canvas.regionselected', onCanvasPositionSelected);
        canvasInstance.html().addEventListener('canvas.splitted', onCanvasTrackSplitted);

        canvasInstance.html().addEventListener('canvas.contextmenu', onCanvasPointContextMenu);
        canvasInstance.html().addEventListener('canvas.error', onCanvasErrorOccurrence);


        // 3d instance listener
        // TODO: add more listener
        // canvasInstance3D?.html()?.perspective.addEventListener('canvas.selected', updateCanvas);
        canvasInstance3D?.html()?.perspective.addEventListener('canvas.drawn', onCanvas3DShapeDrawn);
        canvasInstance3D?.html()?.perspective.addEventListener('canvas.edited', onCanvas3DEditDone);
    }

    const removeListeners = () => {
        canvasInstance.html().removeEventListener('mousedown', onCanvasMouseDown);
        canvasInstance.html().removeEventListener('click', onCanvasClicked);
        canvasInstance.html().removeEventListener('contextmenu', onCanvasContextMenu);
        canvasInstance.html().removeEventListener('canvas.editstart', onCanvasEditStart);
        canvasInstance.html().removeEventListener('canvas.edited', onCanvasEditDone);
        canvasInstance.html().removeEventListener('canvas.dragstart', onCanvasDragStart);
        canvasInstance.html().removeEventListener('canvas.dragstop', onCanvasDragDone);
        canvasInstance.html().removeEventListener('canvas.zoomstart', onCanvasZoomStart);
        canvasInstance.html().removeEventListener('canvas.zoomstop', onCanvasZoomDone);

        canvasInstance.html().removeEventListener('canvas.setup', onCanvasSetup);
        canvasInstance.html().removeEventListener('canvas.canceled', onCanvasCancel);
        canvasInstance.html().removeEventListener('canvas.find', onCanvasFindObject);
        canvasInstance.html().removeEventListener('canvas.deactivated', onCanvasShapeDeactivated);
        canvasInstance.html().removeEventListener('canvas.moved', onCanvasCursorMoved);

        canvasInstance.html().removeEventListener('canvas.zoom', onCanvasZoomChanged);
        canvasInstance.html().removeEventListener('canvas.fit', onCanvasImageFitted);
        canvasInstance.html().removeEventListener('canvas.dragshape', onCanvasShapeDragged);
        canvasInstance.html().removeEventListener('canvas.resizeshape', onCanvasShapeResized);
        canvasInstance.html().removeEventListener('canvas.clicked', onCanvasShapeClicked);
        canvasInstance.html().removeEventListener('canvas.drawn', onCanvasShapeDrawn);
        canvasInstance.html().removeEventListener('canvas.merged', onCanvasObjectsMerged);
        canvasInstance.html().removeEventListener('canvas.groupped', onCanvasObjectsGroupped);
        canvasInstance.html().removeEventListener('canvas.regionselected', onCanvasPositionSelected);
        canvasInstance.html().removeEventListener('canvas.splitted', onCanvasTrackSplitted);

        canvasInstance.html().removeEventListener('canvas.contextmenu', onCanvasPointContextMenu);
        canvasInstance.html().removeEventListener('canvas.error', onCanvasErrorOccurrence);

        // canvasInstance3D?.html()?.perspective.removeEventListener('canvas.selected', updateCanvas);
        canvasInstance3D?.html()?.perspective.removeEventListener('canvas.drawn', onCanvas3DShapeDrawn);
        canvasInstance3D?.html()?.perspective.removeEventListener('canvas.edited', onCanvas3DEditDone);
    }

    const setupFramedata = (): void => {
        const frameData: any = {};
        const img = new Image(imageData['size'][1], imageData['size'][0]);  // Image(width, height)
        const base64String = 'data:image/jpeg;base64,' + imageData['data'];
        img.src = base64String;
        img.onload = async () => {
            frameData['data'] = async () => (
                {
                    renderWidth: imageData['size'][1],
                    renderHeight: imageData['size'][0],
                    imageData: await createImageBitmap(img)
                }
            )
            frameData['width'] = imageData['size'][1];
            frameData['height'] = imageData['size'][0];
            frameData['_data'] = {
                renderWidth: imageData['size'][1],
                renderHeight: imageData['size'][0],
                imageData: await createImageBitmap(img)
            }
            if (frameData) {
                setProjFrameData(frameData)
            }
        }
    }

    const updateProjAttribs = () => {
        const { annotations, projectionAnnotations, onUpdateProjectionAnnotations } = props;
        annotations.forEach((anno: any) => {
            const relatedAnnos = projectionAnnotations
                .filter((projAnno: any) => anno.clientProjID === projAnno.clientProjID);
            relatedAnnos.forEach((projAnno: any) => {
                projAnno.hidden = anno.hidden;
                projAnno.outside = anno.outside ? anno.outside : false;
                projAnno.occluded = anno.occluded;
                projAnno.lock = anno.lock;
                projAnno.label = anno.label;
                projAnno.pinned = anno.pinned;
            });
            onUpdateProjectionAnnotations(relatedAnnos, imageData['size'][0], imageData['size'][1]);
        })
    }

    const updateShowingShapeType = (invisible: Boolean = false) => {
        const { onActivateObject } = props;
        canvasInstance.activate(null);  // to advoid text positional problem
        onActivateObject(null);
        const containerClassName = `canvas-context-container-${imageData['name']}`;
        const cuboidEls = window.document.getElementsByClassName(containerClassName)[0]
            .getElementsByClassName('cvat_canvas_shape_cuboid');
        const rectEls = window.document.getElementsByClassName(containerClassName)[0]
            .querySelectorAll(`rect.cvat_canvas_shape`);
        if (invisible) {
            for (const el of cuboidEls) el.setAttribute('visibility', 'hidden');
            for (const el of rectEls) el.setAttribute('visibility', 'hidden');
            return;
        }
        if (showShapeType === 'cuboid') {
            for (const el of cuboidEls) el.setAttribute('visibility', 'visible');
            for (const el of rectEls) el.setAttribute('visibility', 'hidden');
            canvasInstance.setActivatedShapeType('cuboid');
        }
        else if (showShapeType === 'rectangle') {
            for (const el of cuboidEls) el.setAttribute('visibility', 'hidden');
            for (const el of rectEls) el.setAttribute('visibility', 'visible');
            canvasInstance.setActivatedShapeType('rectangle');
        }
    }

    const handleCreateRectReplica = () => {
        const { jobInstance, frame, onCreateProjectionAnnotations, onUpdateProjectionAnnotations } = props;
        // validate object is null
        if (replicaID === null) {
            notification.error({
                message: '无法创建矩形分身',
                description: '请选择目标 ID',
            });
            return;
        }
        // validate selected ID already exists
        const height = imageData['size'][0];
        const width = imageData['size'][1];
        const centerPoint = [width / 2, height / 2];
        const rectSize = [width / 10, height / 10];
        const rect = [
            centerPoint[0] - rectSize[0],
            centerPoint[1] - rectSize[1],
            centerPoint[0] + rectSize[0],
            centerPoint[1] + rectSize[1],
        ];
        const rectIDs = projectionAnnotations
            .filter((projAnno: any) => projAnno.shapeType === 'rectangle' && projAnno.contextIndex === contextIndex)
            .map((projAnno: any) => projAnno.clientID)
        if (rectIDs.includes(replicaID)) {
            notification.info({
                message: `ID ${replicaID} 已存在矩形映射框`,
                description: '将自动更新原映射目标信息',
            });
            const statesToUpdate = projectionAnnotations
                .filter((projAnno: any) =>
                    projAnno.clientID === replicaID
                    && projAnno.shapeType === 'rectangle'
                    && projAnno.contextIndex === contextIndex);
            for (const stateToUpdate of statesToUpdate) {
                stateToUpdate.points = rect;
                onUpdateProjectionAnnotations([stateToUpdate], height, width);
            }
        }
        else {
            const state3D = annotations.filter((anno: any) => anno.clientID === replicaID)[0];
            const stateToCreate = createAnnotationState(state3D, 'rectangle');
            stateToCreate.points = rect;
            onCreateProjectionAnnotations(jobInstance, frame, [new cvat.classes.ObjectState(stateToCreate)], contextIndex);
        }
        updateShowingShapeType();
    }

    const objectReplicaContent = () => {
        return (
            <div>
                <span>选择目标 ID</span>
                <Select style={{ width: 80, marginLeft: 10 }} onChange={(v: number) => serReplicaID(v)}>
                    {annotations.map((anno: any) => <Option key={`replica-${anno.clientID}`} value={anno.clientID}>{anno.clientID}</Option>)}
                </Select>
                <br />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <Button type="primary" size="small" onClick={handleCreateRectReplica}>创建</Button>
                </div>
            </div>
        );
    }

    const updateIsolatedShape = (isolatedMode: Boolean) => {
        if (!isolatedMode) {
            return
        }
        const { activatedStateID } = props;
        const containerClassName = `canvas-context-container-${imageData['name']}`;
        const elementID = `#cvat_canvas_shape_${activatedStateID}`;
        let isolatedEls = [] as any;
        if (showShapeType === 'cuboid') {
            isolatedEls = window.document.getElementsByClassName(containerClassName)[0]
                .querySelectorAll(`g${elementID}`);
        }
        else if (showShapeType === 'rectangle') {
            isolatedEls = window.document.getElementsByClassName(containerClassName)[0]
                .querySelectorAll(`rect${elementID}`);
        }
        const allEls = window.document.getElementsByClassName(containerClassName)[0]
            .querySelectorAll('.cvat_canvas_shape');

        for (const el of allEls) el.setAttribute('visibility', 'hidden');
        for (const el of isolatedEls) el.setAttribute('visibility', 'visible');
    }

    useEffect(() => {
        if (prevActivatedStateID !== null && prevActivatedStateID !== activatedStateID) {
            canvasInstance.activate(null);
            const els = document.querySelectorAll(`#cvat_canvas_shape_${prevActivatedStateID}`);
            for (const el of els) {
                (el as any).instance.fill({ opacity });
            }
        }
        activateOnCanvas();
    }, [activatedStateID])

    useEffect(() => {
        const [wrapper] = window.document
            .getElementsByClassName(`canvas-context-container-${imageData['name']}`);
        wrapper.appendChild(canvasInstance.html());
        canvasInstance.configure({
            smoothImage,
            autoborders: automaticBordering,
            undefinedAttrValue: consts.UNDEFINED_ATTRIBUTE_VALUE,
            displayAllText: showObjectsTextAlways,
            forceDisableEditing: workspace === Workspace.REVIEW_WORKSPACE,
            intelligentPolygonCrop,
            showProjections,
            creationOpacity: selectedOpacity,
            textFontSize,
            textPosition,
            textContent,
        });
        initialSetup();
        setupFramedata();

        return () => {
            removeListeners();
        }
    }, [])

    useEffect(() => {
        // 初始绘制映射框
        if (annotations && cameraParam) {
            // Set default projection type to Cuboid
            canvasInstance.setActivatedShapeType('cuboid');
            updateCanvas(projectionAnnotations);
            updateShowingShapeType();
            updateShapesView();
            cameraParamRef.current = cameraParam;
        }
        canvasInstance.setActivatedShapeType('cuboid');
    }, [cameraParam, projFrameData]);

    useEffect(() => {
        const { jobInstance, removeObject } = props;
        if (removedAnnotation !== null) {
            const statesToRemove = projectionAnnotations.filter((annotation: any) =>
                annotation.clientID === removedAnnotation.clientID
            )
            for (const stateToRemove of statesToRemove) {
                removeObject(jobInstance, stateToRemove);
            }
        }
    }, [removedAnnotation]);

    useEffect(() => {
        if (latestAnnotation !== null) {
            createProjectionAnnotations(latestAnnotation);
        }
        lastestAnnoRef.current = latestAnnotation;
    }, [latestAnnotation]);

    useEffect(() => {
        canvasInstance.configure({
            undefinedAttrValue: consts.UNDEFINED_ATTRIBUTE_VALUE,
            displayAllText: showObjectsTextAlways,
            autoborders: automaticBordering,
            showProjections,
            intelligentPolygonCrop,
            creationOpacity: selectedOpacity,
            smoothImage,
            textFontSize,
            textPosition,
            textContent,
        });
    }, [
        showObjectsTextAlways, automaticBordering, showProjections,
        intelligentPolygonCrop, selectedOpacity, smoothImage,
        textFontSize, textPosition, textContent
    ])

    useEffect(() => {
        updateShapesView();
    }, [opacity, outlined, outlineColor, selectedOpacity, colorBy])

    useEffect(() => {
        updateShowingShapeType(annosInvisibility);
        updateIsolatedShape(isolatedMode);
    }, [showShapeType, annosInvisibility, isolatedMode])

    useEffect(() => {
        updateCanvas(projectionAnnotations);
        updateShapesView();
        updateShowingShapeType();
        projAnnosRef.current = projectionAnnotations;
    }, [projectionAnnotations])

    useEffect(() => {
        updateProjAttribs();
    }, [annotations])

    return (
        <div className='cvat-canvas-context-wrapper' >
            <div className='cvat-canvas-context-wrapper-tools' >
                <span className='cvat-canvas-context-wrapper-tools-index' >
                    {contextIndex + 1}
                </span>
                <CVATTooltip title='显示映射 2D 立体框' placement='topLeft'>
                    <Tag
                        color={showShapeType === 'cuboid' ? 'blue' : ''}
                        className='cvat-canvas-context-wrapper-tools-item'
                        onClick={() => setShowShapeType('cuboid')}
                    >
                        <BsBox />
                    </Tag>
                </CVATTooltip>
                <CVATTooltip title='显示映射矩形框' placement='topLeft'>
                    <Tag
                        color={showShapeType === 'rectangle' ? 'blue' : ''}
                        className='cvat-canvas-context-wrapper-tools-item'
                        onClick={() => setShowShapeType('rectangle')}
                    >
                        <BsBoundingBoxCircles />
                    </Tag>
                </CVATTooltip>
                <span className='cvat-canvas-context-wrapper-tools-divide' />
                <CVATTooltip title='隐藏所有映射标注框' placement='topLeft'>
                    <Tag
                        color={annosInvisibility ? 'blue' : ''}
                        className='cvat-canvas-context-wrapper-tools-item'
                        onClick={() => setAnnosInvisibility(!annosInvisibility)}
                    >
                        <RiEyeCloseLine />
                    </Tag>
                </CVATTooltip>
                <CVATTooltip title='孤立模式' placement='topLeft'>
                    <Tag
                        color={isolatedMode ? 'blue' : ''}
                        className='cvat-canvas-context-wrapper-tools-item'
                        onClick={() => setIsolatedMode(!isolatedMode)}
                    >
                        <MdOutlineFilterCenterFocus />
                    </Tag>
                </CVATTooltip>
                <CVATTooltip title='创建分身' placement='topLeft'>
                    <Popover
                        placement="rightTop"
                        title={<span style={{ display: 'flex', alignItems: 'center' }}><BsBoundingBoxCircles style={{ marginRight: 5 }} /> 创建矩形分身</span>}
                        trigger="click"
                        content={() => objectReplicaContent()}
                    >
                        <Tag
                            className='cvat-canvas-context-wrapper-tools-item'
                            onClick={() => null}
                        >
                            <HiOutlineDuplicate />
                        </Tag>
                    </Popover>
                </CVATTooltip>
            </div>
            <div className={`canvas-context-container-${imageData['name']} canvas-context-container`} />
            {imageData &&
                <Paragraph className='cvat-canvas-context-wrapper-imagename'>
                    <pre>{imageData.name}</pre>
                </Paragraph>
            }
        </div>
    );
}

export default CanvasWrapperContextComponent;