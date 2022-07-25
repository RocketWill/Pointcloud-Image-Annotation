/*
 * @Date: 2022-04-08 23:15:44
 * @Company: Luokung Technology Corp.
 * @LastEditors: Will Cheng Yong chengyong@pku.edu.cn
 * @LastEditTime: 2022-07-23 10:04:23
 */

import { connect } from 'react-redux';
import { KeyMap } from 'utils/mousetrap-react';

import CanvasWrapperContextComponent from 'components/annotation-page/canvas/canvas-context';
import {
    confirmCanvasReady,
    dragCanvas,
    zoomCanvas,
    resetCanvas,
    shapeDrawn,
    mergeObjects,
    groupObjects,
    splitTrack,
    editShape,
    updateAnnotationsAsync,
    updateProjectionAnnotationsAsync,
    createAnnotationsAsync,
    createProjectionAnnotationsAsync,
    mergeAnnotationsAsync,
    groupAnnotationsAsync,
    splitAnnotationsAsync,
    activateObject,
    updateCanvasContextContextMenu,
    addZLayer,
    switchZLayer,
    fetchAnnotationsAsync,
    getDataFailed,
    removeProjectionObjectAsync,
} from 'actions/annotation-actions';
import {
    switchGrid,
    changeGridColor,
    changeGridOpacity,
    changeBrightnessLevel,
    changeContrastLevel,
    changeSaturationLevel,
    switchAutomaticBordering,
} from 'actions/settings-actions';
import { reviewActions } from 'actions/review-actions';
import {
    ColorBy,
    GridColor,
    ObjectType,
    CombinedState,
    ContextMenuType,
    Workspace,
    ActiveControl,
} from 'reducers/interfaces';

import { Canvas } from 'cvat-canvas-wrapper';
import { Canvas3d } from 'cvat-canvas3d-wrapper';

interface ImageData {
    size: number[];
    name: string;
    data: string;
}

interface StateToProps {
    sidebarCollapsed: boolean;
    canvasInstance: Canvas | Canvas3d | null;
    jobInstance: any;
    activatedStateID: number | null;
    activatedAttributeID: number | null;
    annotations: any[];
    latestAnnotation: any;
    removedAnnotation: any;
    projectionAnnotations: any[];
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
    minZLayer: number;
    maxZLayer: number;
    curZLayer: number;
    automaticBordering: boolean;
    intelligentPolygonCrop: boolean;
    switchableAutomaticBordering: boolean;
    keyMap: KeyMap;
    canvasBackgroundColor: string;
    cameraParam: any;
    imageData: ImageData;
    imageName: string;
    contextIndex: number;
    psrToXyz: Function;
    points3dHomoToImage2d: Function;
}

interface DispatchToProps {
    onSetupCanvas(): void;
    onDragCanvas: (enabled: boolean) => void;
    onZoomCanvas: (enabled: boolean) => void;
    onResetCanvas: () => void;
    onShapeDrawn: () => void;
    onMergeObjects: (enabled: boolean) => void;
    onGroupObjects: (enabled: boolean) => void;
    onSplitTrack: (enabled: boolean) => void;
    onEditShape: (enabled: boolean) => void;
    onUpdateAnnotations(states: any[]): void;
    onUpdateProjectionAnnotations(states: any[], height_: number | null, width_: number | null): void;
    onCreateAnnotations(sessionInstance: any, frame: number, states: any[]): void;
    onCreateProjectionAnnotations(sessionInstance: any, frame: number, projectionIndexStates: any[], contextIndex: number): void;
    onMergeAnnotations(sessionInstance: any, frame: number, states: any[]): void;
    onGroupAnnotations(sessionInstance: any, frame: number, states: any[]): void;
    onSplitAnnotations(sessionInstance: any, frame: number, state: any): void;
    onActivateObject: (activatedStateID: number | null, contextIndex: number) => void;
    onUpdateContextMenu(visible: boolean, left: number, top: number, type: ContextMenuType, contextIndex: number, pointID?: number): void;
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
    removeObject(sessionInstance: any, objectState: any): void;
}

function mapStateToProps(
    state: CombinedState,
    { imageData, imageName, contextIndex, boxOps: { psrToXyz, points3dHomoToImage2d } }:
    { imageData: ImageData, imageName: string, contextIndex: number,
      boxOps: { psrToXyz: Function, points3dHomoToImage2d: Function } }
): StateToProps {
    const {
        annotation: {
            canvas: { activeControl, instance: canvasInstance },
            drawing: { activeLabelID, activeObjectType },
            job: { instance: jobInstance },
            player: {
                frame: { data: frameData, number: frame, fetching: frameFetching },
                frameAngles,
                cameraParam,
            },
            annotations: {
                latestState: latestAnnotation,
                removedState: removedAnnotation,
                states: annotations,
                projectionStates: projectionAnnotations,
                activatedStateID,
                activatedAttributeID,
                zLayer: { cur: curZLayer, min: minZLayer, max: maxZLayer },
            },
            sidebarCollapsed,
            workspace,
        },
        settings: {
            player: {
                canvasBackgroundColor,
                grid,
                gridSize,
                gridColor,
                gridOpacity,
                brightnessLevel,
                contrastLevel,
                saturationLevel,
                resetZoom,
                smoothImage,
            },
            workspace: {
                aamZoomMargin,
                showObjectsTextAlways,
                showAllInterpolationTracks,
                automaticBordering,
                intelligentPolygonCrop,
                textFontSize,
                textPosition,
                textContent,
            },
            shapes: {
                opacity, colorBy, selectedOpacity, outlined, outlineColor, showBitmap, showProjections,
            },
        },
        shortcuts: { keyMap },
    } = state;

    return {
        sidebarCollapsed,
        canvasInstance,
        jobInstance,
        frameData,
        frameAngle: frameAngles[frame - jobInstance.startFrame],
        frameFetching,
        frame,
        activatedStateID,
        activatedAttributeID,
        annotations,
        latestAnnotation,
        removedAnnotation,
        projectionAnnotations,
        opacity: opacity / 100,
        colorBy,
        selectedOpacity: selectedOpacity / 100,
        outlined,
        outlineColor,
        showBitmap,
        showProjections,
        grid,
        gridSize,
        gridColor,
        gridOpacity: gridOpacity / 100,
        activeLabelID,
        activeObjectType,
        brightnessLevel: brightnessLevel / 100,
        contrastLevel: contrastLevel / 100,
        saturationLevel: saturationLevel / 100,
        resetZoom,
        smoothImage,
        aamZoomMargin,
        showObjectsTextAlways,
        textFontSize,
        textPosition,
        textContent,
        showAllInterpolationTracks,
        curZLayer,
        minZLayer,
        maxZLayer,
        automaticBordering,
        intelligentPolygonCrop,
        workspace,
        keyMap,
        canvasBackgroundColor,
        switchableAutomaticBordering:
            activeControl === ActiveControl.DRAW_POLYGON ||
            activeControl === ActiveControl.DRAW_POLYLINE ||
            activeControl === ActiveControl.EDIT,
        cameraParam,
        imageData,
        imageName,
        contextIndex,
        psrToXyz,
        points3dHomoToImage2d,
    };
}

function mapDispatchToProps(dispatch: any): DispatchToProps {
    return {
        onSetupCanvas(): void {
            dispatch(confirmCanvasReady());
        },
        onDragCanvas(enabled: boolean): void {
            dispatch(dragCanvas(enabled));
        },
        onZoomCanvas(enabled: boolean): void {
            dispatch(zoomCanvas(enabled));
        },
        onResetCanvas(): void {
            dispatch(resetCanvas());
        },
        onShapeDrawn(): void {
            dispatch(shapeDrawn());
        },
        onMergeObjects(enabled: boolean): void {
            dispatch(mergeObjects(enabled));
        },
        onGroupObjects(enabled: boolean): void {
            dispatch(groupObjects(enabled));
        },
        onSplitTrack(enabled: boolean): void {
            dispatch(splitTrack(enabled));
        },
        onEditShape(enabled: boolean): void {
            dispatch(editShape(enabled));
        },
        onUpdateAnnotations(states: any[]): void {
            dispatch(updateAnnotationsAsync(states));
        },
        onUpdateProjectionAnnotations(states: any[], height_: number | null, width_: number | null): void {
            dispatch(updateProjectionAnnotationsAsync(states, height_, width_));
        },
        onCreateAnnotations(sessionInstance: any, frame: number, states: any[]): void {
            dispatch(createAnnotationsAsync(sessionInstance, frame, states));
        },
        onCreateProjectionAnnotations(sessionInstance: any, frame: number, projectionIndexStates: any[], contextIndex: number): void {
            dispatch(createProjectionAnnotationsAsync(sessionInstance, frame, projectionIndexStates, contextIndex));
        },
        onMergeAnnotations(sessionInstance: any, frame: number, states: any[]): void {
            dispatch(mergeAnnotationsAsync(sessionInstance, frame, states));
        },
        onGroupAnnotations(sessionInstance: any, frame: number, states: any[]): void {
            dispatch(groupAnnotationsAsync(sessionInstance, frame, states));
        },
        onSplitAnnotations(sessionInstance: any, frame: number, state: any): void {
            dispatch(splitAnnotationsAsync(sessionInstance, frame, state));
        },
        onActivateObject(activatedStateID: number | null, contextIndex: number): void {
            if (activatedStateID === null) {
                dispatch(updateCanvasContextContextMenu(false, 0, 0, contextIndex));
            }

            dispatch(activateObject(activatedStateID, null));
        },
        onUpdateContextMenu(
            visible: boolean,
            left: number,
            top: number,
            type: ContextMenuType,
            contextIndex: number,
            pointID?: number,
        ): void {
            dispatch(updateCanvasContextContextMenu(visible, left, top, contextIndex, pointID, type));
        },
        onAddZLayer(): void {
            dispatch(addZLayer());
        },
        onSwitchZLayer(cur: number): void {
            dispatch(switchZLayer(cur));
        },
        onChangeBrightnessLevel(level: number): void {
            dispatch(changeBrightnessLevel(level));
        },
        onChangeContrastLevel(level: number): void {
            dispatch(changeContrastLevel(level));
        },
        onChangeSaturationLevel(level: number): void {
            dispatch(changeSaturationLevel(level));
        },
        onChangeGridOpacity(opacity: number): void {
            dispatch(changeGridOpacity(opacity));
        },
        onChangeGridColor(color: GridColor): void {
            dispatch(changeGridColor(color));
        },
        onSwitchGrid(enabled: boolean): void {
            dispatch(switchGrid(enabled));
        },
        onSwitchAutomaticBordering(enabled: boolean): void {
            dispatch(switchAutomaticBordering(enabled));
        },
        onFetchAnnotation(): void {
            dispatch(fetchAnnotationsAsync());
        },
        onGetDataFailed(error: any): void {
            dispatch(getDataFailed(error));
        },
        onStartIssue(position: number[]): void {
            dispatch(reviewActions.startIssue(position));
        },
        removeObject(sessionInstance: any, objectState: any): void {
            dispatch(removeProjectionObjectAsync(sessionInstance, objectState, true));
        },
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(CanvasWrapperContextComponent);
