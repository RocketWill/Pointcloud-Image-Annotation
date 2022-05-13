/*
 * @Date: 2022-04-08 16:01:25
 * @Company: Luokung Technology Corp.
 * @LastEditors: Will Cheng
 * @LastEditTime: 2022-04-18 15:10:17
 */
import React, {
    ReactElement, SyntheticEvent, useEffect, useReducer, useRef, useMemo, useState
} from 'react';
import { usePrevious } from 'utils/hooks';
import Typography from 'antd/lib/typography';
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
import { Calib } from '../standard-workspace/context-image/shared'
import { fdatasync } from 'fs';

const cvat = getCore();

const MAX_DISTANCE_TO_OPEN_SHAPE = 50;

const { Paragraph } = Typography;

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
    onUpdateProjectionAnnotations(states: any[]): void;
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
    const [listenProjection, setListenProjection] = useState(false);
    const projAnnosRef = useRef();
    const lastestAnnoRef = useRef();
    const cameraParamRef = useRef();
    const {
        opacity,
        outlined,
        outlineColor,
        colorBy,
        frameFetching,
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
        psrToXyz,
        points3dHomoToImage2d,
        canvasInstance: canvasInstance3D,  // 3d instance
        onUpdateProjectionAnnotations,
        onCreateProjectionAnnotations,
        removeObject,
    } = props;
    const prevActivatedStateID = usePrevious(activatedStateID);
    const canvasInstance = useMemo(() => new Canvas(), []);  // 2d instance
    const cameraParam = allCameraParam?.data?.[imageName];
    const {
        maxZLayer,
        curZLayer,
        minZLayer,
        keyMap,
        switchableAutomaticBordering,
        onSwitchAutomaticBordering,
        onSwitchZLayer,
        onAddZLayer,
    } = props;

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

    const preventDefault = (event: KeyboardEvent | undefined): void => {
        if (event) {
            event.preventDefault();
        }
    };

    // const subKeyMap = {
    //     SWITCH_AUTOMATIC_BORDERING: keyMap.SWITCH_AUTOMATIC_BORDERING,
    // };

    const handlers = {
        SWITCH_AUTOMATIC_BORDERING: (event: KeyboardEvent | undefined) => {
            if (switchableAutomaticBordering) {
                preventDefault(event);
                onSwitchAutomaticBordering(!automaticBordering);
            }
        },
    };

    const boxTo2DPoints = (points: number[], calib: Calib) => {
        const position = [points[0], points[1], points[2]];
        const rotation = [points[3], points[4], points[5]];
        const scale    = [points[6], points[7], points[8]];
        let box3d = psrToXyz(position, scale, rotation);
        box3d = box3d.slice(0, 8 * 4);
        const box2dPoints = points3dHomoToImage2d(box3d, calib, false, []);
        return box2dPoints;
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
        onEditShape(false);
        const { state, points, rotation } = event.detail;
        state.points = points;
        state.rotation = rotation;
        onUpdateProjectionAnnotations([state]);
        // const projAnnos = projAnnotations(null);
        // onCreateProjectionAnnotations(jobInstance, frame, projAnnos, contextIndex)
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
            annotations,
        } = props;

        if (activatedStateID !== null) {
            const [activatedState] = annotations.filter((state: any): boolean => state.clientID === activatedStateID);
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

    const calProjectionAnno = (points: any): any => {
        if (!cameraParam) {
            console.error('Camera params not found!');
            return null;
        }
        if (!points) {
            return null;
        }
        const susBox = boxTo2DPoints(points, cameraParam);
        if (susBox === null) return null;
        return [
            susBox[4],  susBox[5],
            susBox[2],  susBox[3],
            susBox[6],  susBox[7],
            susBox[0],  susBox[1],
            susBox[14], susBox[15],
            susBox[8],  susBox[9],
            susBox[12], susBox[13],
            susBox[10], susBox[11]
        ]
    }

    const calCreateProjectionAnno = (annotation: any, cameraParam: any): any => {
        const box = calProjectionAnno(annotation.points);
        if (box === null) return null;
        const annotationState = createAnnotationState(annotation);
        annotationState.points = box;
        return annotationState;
    }

    const createAnnotationState = (annotation: any) => {
        return ({
            points: annotation.points,
            color: annotation.label.color,
            clientID: annotation.clientID,
            zOrder: annotation.zOrder,
            hidden: annotation.hidden,
            outside: annotation.outside,
            occluded: annotation.occluded,
            shapeType: 'cuboid',
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

    const projAnnotations = (event: any): any => {
        if (!cameraParam) return;
        const clientID = event?.detail?.clientID;
        let filteredAnnotations = annotations.map((annotation: any) => {
            const box = boxTo2DPoints(annotation.points, cameraParam);
            if (box) {
                // calculate target quantity in context image
                // if (clientID === annotation.clientID) {
                //     calculateTargetInContext(annotation.clientID, imageName);
                // }
                const boxPoints = [
                    box[4], box[5],
                    box[2], box[3],
                    box[6], box[7],
                    box[0], box[1],
                    box[14], box[15],
                    box[8], box[9],
                    box[12], box[13],
                    box[10], box[11]
                ]
                return ({
                    points: boxPoints,
                    color: annotation.label.color,
                    clientID: annotation.clientID,
                    zOrder: annotation.zOrder,
                    hidden: annotation.hidden,
                    outside: annotation.outside,
                    occluded: annotation.occluded,
                    shapeType: 'cuboid',
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
        })
        filteredAnnotations = filteredAnnotations.filter((annotation: any) => annotation !== undefined);
        // canvasInstance.setupObjectsUnite(filteredAnnotations);
        return filteredAnnotations;
    }

    const createProjectionAnnotations = (state3D: any) => {
        const { jobInstance, frame } = props;
        const stateToCreate = calCreateProjectionAnno(state3D, cameraParamRef.current);
        if (stateToCreate !== null) {
            onCreateProjectionAnnotations(jobInstance, frame, [new cvat.classes.ObjectState(stateToCreate)], contextIndex);
        }
    }

    const onCanvas3DShapeDrawn = (e: any): void => {
        console.log("🤡 ~ file: canvas-context.tsx ~ line 575 ~ onCanvas3DShapeDrawn ~ e", e)
    }

    const onCanvas3DEditDone = (e: any): void => {
        const { points, state } = e.detail;
        const { jobInstance, frame } = props;
        const projectionState = calProjectionAnno(points);
        const prevState = projAnnosRef.current.filter((projState: any) => projState.clientID === state.clientID && contextIndex === projState.contextIndex)
        if (prevState.length > 0 && projectionState !== null) {
            prevState[0].points = projectionState;
            console.log(`Update 2D projection of Client ${state.clientID}.`);
            onUpdateProjectionAnnotations([prevState[0]]);
        }
        if (prevState.length === 0 && projectionState !== null) {
            // create
            const stateToCreate = createAnnotationState(state);
            stateToCreate.points = projectionState;
            onCreateProjectionAnnotations(jobInstance, frame, [new cvat.classes.ObjectState(stateToCreate)], contextIndex);
            console.log(`Create ouside 2D projection of Client ${state.clientID}.`);
        }
        if (prevState.length !== 0 && projectionState === null) {
            // delete
            removeObject(jobInstance, prevState[0]);
            console.log(`Remove ouside 2D projection of Client ${state.clientID}.`);
        }
    }

    const updateCanvas = (e: any): void => {
        if (projFrameData) {
            canvasInstance.setup(
                projFrameData,
                projectionAnnotations.filter((projAnnotation: any) =>
                    projAnnotation.contextIndex === contextIndex &&
                    projAnnotation.frame === frame
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

        const result = await jobInstance.annotations.select(event.detail.states, event.detail.x, event.detail.y);
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
            brightnessLevel,
            contrastLevel,
            saturationLevel,
            canvasBackgroundColor,
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
        // canvasInstance3D?.html()?.perspective.addEventListener('canvas.edited', updateCanvas);
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
            // canvasInstance3D?.html()?.perspective.removeEventListener('canvas.edited', updateCanvas);
            canvasInstance3D?.html()?.perspective.removeEventListener('canvas.drawn', onCanvas3DShapeDrawn);
            canvasInstance3D?.html()?.perspective.removeEventListener('canvas.edited', onCanvas3DEditDone);
    }

    const setupFramedata = (): void => {
        // const { frameData } = props;
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
            if (frameData !== {}) {
                setProjFrameData(frameData)
            }
        }
    }

    const getAnnotationsIndices = (annotations: any[]) => (
        annotations.map((annotation: any) => annotation.clientID)
    )

    useEffect(() => {
        const [wrapper] = window.document.getElementsByClassName(`canvas-context-container-${imageData['name']}`);
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
            updateCanvas(null);
            updateShapesView();
            cameraParamRef.current = cameraParam;
        }
    }, [cameraParam, projFrameData]);

    useEffect(() => {
        const { jobInstance } = props;
        if (removedAnnotation !== null) {
            const stateToRemove = projectionAnnotations.filter((annotation: any) =>
                annotation.clientID === removedAnnotation.clientID
            )
            if (stateToRemove.length > 0) {
                removeObject(jobInstance, stateToRemove[0]);
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
        showObjectsTextAlways, automaticBordering, showProjections, intelligentPolygonCrop,
        selectedOpacity, smoothImage, textFontSize, textPosition, textContent
    ])

    useEffect(() => {
        updateShapesView();
    }, [opacity, outlined, outlineColor, selectedOpacity, colorBy])

    useEffect(() => {
        updateCanvas(null);
        updateShapesView();
        projAnnosRef.current = projectionAnnotations;
    }, [projectionAnnotations])

    return (
        <div style={{ margin: 10, marginRight: 20, padding: 10, background: 'rgba(0, 0, 0, 0.05)', borderRadius: 5 }}>
            <div className={`canvas-context-container-${imageData['name']}`}
                style={{
                    overflow: 'hidden',
                    width: '100%',
                    height: 200,
                }}
            />
            {imageData &&
                <Paragraph style={{ margin: '-14px 5px -7px 10px' }}>
                    <pre>{imageData.name}</pre>
                </Paragraph>
            }
        </div>
    );
}

export default CanvasWrapperContextComponent;