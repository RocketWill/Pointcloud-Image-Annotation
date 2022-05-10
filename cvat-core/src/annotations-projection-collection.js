// Copyright (C) 2019-2022 Intel Corporation
//
// SPDX-License-Identifier: MIT

(() => {
    const {
        CuboidShape,
        CuboidTrack,
        Track,
        Shape,
        Tag,
        objectStateFactory,
    } = require('./annotations-objects');
    const AnnotationsFilter = require('./annotations-filter');
    const { checkObjectType } = require('./common');
    const Statistics = require('./statistics');
    const { Label } = require('./labels');
    const { DataError, ArgumentError, ScriptingError } = require('./exceptions');

    const {
        HistoryActions, ObjectShape, ObjectType, colors,
    } = require('./enums');
    const ObjectState = require('./object-state');

    function shapeFactory(shapeData, clientID, injection) {
        const { type } = shapeData;
        const color = colors[clientID % colors.length];

        let shapeModel = null;
        switch (type) {
            case 'cuboid':
                shapeModel = new CuboidShape(shapeData, clientID, color, injection);
                break;
            default:
                throw new DataError(`An unexpected type of shape "${type}"`);
        }
        return shapeModel;
    }

    class ProjectionCollection {
        constructor(data) {
            this.startFrame = data.startFrame;
            this.stopFrame = data.stopFrame;
            this.frameMeta = data.frameMeta;

            this.labels = data.labels.reduce((labelAccumulator, label) => {
                labelAccumulator[label.id] = label;
                return labelAccumulator;
            }, {});

            this.annotationsFilter = new AnnotationsFilter();
            this.history = data.history;
            this.shapes = {}; // key is a frame
            this.tags = {}; // key is a frame
            this.tracks = [];
            this.objects = {}; // key is a client id
            this.count = 0;
            this.flush = false;
            this.groups = {
                max: 0,
            }; // it is an object to we can pass it as an argument by a reference
            this.injection = {
                labels: this.labels,
                groups: this.groups,
                frameMeta: this.frameMeta,
                history: this.history,
                groupColors: {},
            };
        }

        import(data) {
            // only support shape in this version
            const result = {
                tags: [],
                shapes: [],
                tracks: [],
            };
            for (const shape of data.shapes) {
                const clientID = shape.client_id;
                const shapeModel = shapeFactory(shape, clientID, this.injection);
                this.shapes[shapeModel.frame] = this.shapes[shapeModel.frame] || [];
                this.shapes[shapeModel.frame].push(shapeModel);
                const objectKey = `${clientID}-${shape.context_index}`  // a clientID could exist in many canvas
                this.objects[objectKey] = shapeModel;
                result.shapes.push(shapeModel);
            }
            return result;
        }

        export() {
            // only support shape in this version
            const data = {
                shapes: Object.values(this.shapes)
                    .reduce((accumulator, value) => {
                        accumulator.push(...value);
                        return accumulator;
                    }, [])
                    .filter((shape) => !shape.removed)
                    .map((shape) => shape.toJSON()),
                tracks: [],
                tags: []
            };
            return data;
        }

        get(frame, filters) {
            // only support shape in this version
            const shapes = this.shapes[frame] || [];
            const objects = [...shapes];
            const visible = {
                models: [],
                data: [],
            };

            for (const object of objects) {
                if (object.removed) {
                    continue;
                }

                const stateData = object.get(frame);
                if (stateData.outside && !stateData.keyframe) {
                    continue;
                }

                visible.models.push(object);
                visible.data.push(stateData);
            }

            const objectStates = [];
            const filtered = this.annotationsFilter.filter(visible.data, filters);

            visible.data.forEach((stateData, idx) => {
                if (!filters.length || filtered.includes(stateData.clientID)) {
                    const model = visible.models[idx];
                    const objectState = objectStateFactory.call(model, frame, stateData);
                    objectStates.push(objectState);
                }
            });
            return objectStates;
        }

        clear(startframe, endframe, delTrackKeyframesOnly) {
            if (startframe !== undefined && endframe !== undefined) {
                // If only a range of annotations need to be cleared
                for (let frame = startframe; frame <= endframe; frame++) {
                    this.shapes[frame] = [];
                    this.tags[frame] = [];
                }
            } else if (startframe === undefined && endframe === undefined) {
                // If all annotations need to be cleared
                this.shapes = {};
                this.tags = {};
                this.tracks = [];
                this.objects = {}; // by id
                this.count = 0;

                this.flush = true;
            } else {
                // If inputs provided were wrong
                throw Error('Could not remove the annotations, please provide both inputs or' +
                    ' leave the inputs below empty to remove all the annotations from this job');
            }
        }

        statistics() {
            const labels = {};
            const skeleton = {
                rectangle: {
                    shape: 0,
                    track: 0,
                },
                polygon: {
                    shape: 0,
                    track: 0,
                },
                polyline: {
                    shape: 0,
                    track: 0,
                },
                points: {
                    shape: 0,
                    track: 0,
                },
                ellipse: {
                    shape: 0,
                    track: 0,
                },
                cuboid: {
                    shape: 0,
                    track: 0,
                },
                tags: 0,
                manually: 0,
                interpolated: 0,
                total: 0,
            };

            const total = JSON.parse(JSON.stringify(skeleton));
            for (const label of Object.values(this.labels)) {
                const { name } = label;
                labels[name] = JSON.parse(JSON.stringify(skeleton));
            }

            for (const object of Object.values(this.objects)) {
                if (object.removed) {
                    continue;
                }

                let objectType = null;
                if (object instanceof Shape) {
                    objectType = 'shape';
                } else if (object instanceof Track) {
                    objectType = 'track';
                } else if (object instanceof Tag) {
                    objectType = 'tag';
                } else {
                    throw new ScriptingError(`Unexpected object type: "${objectType}"`);
                }

                const label = object.label.name;
                if (objectType === 'tag') {
                    labels[label].tags++;
                    labels[label].manually++;
                    labels[label].total++;
                } else {
                    const { shapeType } = object;
                    labels[label][shapeType][objectType]++;

                    if (objectType === 'track') {
                        const keyframes = Object.keys(object.shapes)
                            .sort((a, b) => +a - +b)
                            .map((el) => +el);

                        let prevKeyframe = keyframes[0];
                        let visible = false;

                        for (const keyframe of keyframes) {
                            if (visible) {
                                const interpolated = keyframe - prevKeyframe - 1;
                                labels[label].interpolated += interpolated;
                                labels[label].total += interpolated;
                            }
                            visible = !object.shapes[keyframe].outside;
                            prevKeyframe = keyframe;

                            if (visible) {
                                labels[label].manually++;
                                labels[label].total++;
                            }
                        }

                        const lastKey = keyframes[keyframes.length - 1];
                        if (lastKey !== this.stopFrame && !object.shapes[lastKey].outside) {
                            const interpolated = this.stopFrame - lastKey;
                            labels[label].interpolated += interpolated;
                            labels[label].total += interpolated;
                        }
                    } else {
                        labels[label].manually++;
                        labels[label].total++;
                    }
                }
            }

            for (const label of Object.keys(labels)) {
                for (const key of Object.keys(labels[label])) {
                    if (typeof labels[label][key] === 'object') {
                        for (const objectType of Object.keys(labels[label][key])) {
                            total[key][objectType] += labels[label][key][objectType];
                        }
                    } else {
                        total[key] += labels[label][key];
                    }
                }
            }

            return new Statistics(labels, total);
        }

        put(objectStates) {
            checkObjectType('shapes for put', objectStates, null, Array);
            const constructed = {
                shapes: [],
                tracks: [],
                tags: [],
            };

            function convertAttributes(accumulator, attrID) {
                const specID = +attrID;
                const value = this.attributes[attrID];

                checkObjectType('attribute id', specID, 'integer', null);
                checkObjectType('attribute value', value, 'string', null);

                accumulator.push({
                    spec_id: specID,
                    value,
                });

                return accumulator;
            }

            for (const state of objectStates) {
                checkObjectType('object state', state, null, ObjectState);
                checkObjectType('state client ID', state.clientID, 'integer', null); // should be 3d box's id
                checkObjectType('state frame', state.frame, 'integer', null);
                checkObjectType('state rotation', state.rotation || 0, 'number', null);
                checkObjectType('state attributes', state.attributes, null, Object);
                checkObjectType('state label', state.label, null, Label);

                const attributes = Object.keys(state.attributes).reduce(convertAttributes.bind(state), []);
                const labelAttributes = state.label.attributes.reduce((accumulator, attribute) => {
                    accumulator[attribute.id] = attribute;
                    return accumulator;
                }, {});

                // Construct whole objects from states
                if (state.objectType === 'tag') {
                    constructed.tags.push({
                        attributes,
                        frame: state.frame,
                        label_id: state.label.id,
                        group: 0,
                    });
                } else {
                    checkObjectType('state occluded', state.occluded, 'boolean', null);
                    checkObjectType('state points', state.points, null, Array);
                    checkObjectType('state zOrder', state.zOrder, 'integer', null);
                    checkObjectType('state descriptions', state.descriptions, null, Array);
                    state.descriptions.forEach((desc) => checkObjectType('state description', desc, 'string'));

                    for (const coord of state.points) {
                        checkObjectType('point coordinate', coord, 'number', null);
                    }

                    // if (!Object.values(ObjectShape).includes(state.shapeType)) {
                    //     throw new ArgumentError(
                    //         `Object shape must be one of: ${JSON.stringify(Object.values(ObjectShape))}`,
                    //     );
                    // }
                    // if (state.objectType === 'cuboid')
                    if (state.shapeType === 'cuboid') {
                        constructed.shapes.push({
                            client_id: state.clientID,
                            attributes,
                            descriptions: state.descriptions,
                            frame: state.frame,
                            context_index: state.contextIndex,
                            modified_2d: false,
                            group: 0,
                            label_id: state.label.id,
                            occluded: state.occluded || false,
                            points: [...state.points],
                            rotation: state.rotation || 0,
                            type: state.shapeType,
                            z_order: state.zOrder,
                            source: state.source,
                        });
                    } else {
                        throw new ArgumentError(
                            `Object type must be one of: ${JSON.stringify(Object.values(ObjectType))}`,
                        );
                    }
                }
            }

            // Add constructed objects to a collection
            // eslint-disable-next-line no-unsanitized/method
            const imported = this.import(constructed);
            const importedArray = imported.shapes;

            if (objectStates.length) {
                this.history.do(
                    HistoryActions.CREATED_OBJECTS,
                    () => {
                        importedArray.forEach((object) => {
                            object.removed = true;
                        });
                    },
                    () => {
                        importedArray.forEach((object) => {
                            object.removed = false;
                            object.serverID = undefined;
                        });
                    },
                    importedArray.map((object) => `${object.clientID}-${object.contextIndex}`),
                    objectStates[0].frame,
                );
            }

            return importedArray.map((value) => `${value.clientID}-${value.contextIndex}`);
        }

        select(objectStates, x, y) {
            checkObjectType('shapes for select', objectStates, null, Array);
            checkObjectType('x coordinate', x, 'number', null);
            checkObjectType('y coordinate', y, 'number', null);

            let minimumDistance = null;
            let minimumState = null;
            for (const state of objectStates) {
                checkObjectType('object state', state, null, ObjectState);
                if (state.outside || state.hidden || state.objectType === ObjectType.TAG) {
                    continue;
                }
                const objectKey = `${state.clientID}-${state.contextIndex}`
                const object = this.objects[objectKey];
                if (typeof object === 'undefined') {
                    throw new ArgumentError('The object has not been saved yet. Call annotations.put([state]) before');
                }
                const distance = object.constructor.distance(state.points, x, y, state.rotation);
                if (distance !== null && (minimumDistance === null || distance < minimumDistance)) {
                    minimumDistance = distance;
                    minimumState = state;
                }
            }

            return {
                state: minimumState,
                distance: minimumDistance,
            };
        }

        searchEmpty(frameFrom, frameTo) {
            const sign = Math.sign(frameTo - frameFrom);
            const predicate = sign > 0 ? (frame) => frame <= frameTo : (frame) => frame >= frameTo;
            const update = sign > 0 ? (frame) => frame + 1 : (frame) => frame - 1;
            for (let frame = frameFrom; predicate(frame); frame = update(frame)) {
                if (frame in this.shapes && this.shapes[frame].some((shape) => !shape.removed)) {
                    continue;
                }
                if (frame in this.tags && this.tags[frame].some((tag) => !tag.removed)) {
                    continue;
                }
                const filteredTracks = this.tracks.filter((track) => !track.removed);
                let found = false;
                for (const track of filteredTracks) {
                    const keyframes = track.boundedKeyframes(frame);
                    const { prev, first } = keyframes;
                    const last = prev === null ? first : prev;
                    const lastShape = track.shapes[last];
                    const isKeyfame = frame in track.shapes;
                    if (first <= frame && (!lastShape.outside || isKeyfame)) {
                        found = true;
                        break;
                    }
                }

                if (found) continue;

                return frame;
            }

            return null;
        }

        search(filters, frameFrom, frameTo) {
            const sign = Math.sign(frameTo - frameFrom);
            const filtersStr = JSON.stringify(filters);
            const linearSearch = filtersStr.match(/"var":"width"/) || filtersStr.match(/"var":"height"/);

            const predicate = sign > 0 ? (frame) => frame <= frameTo : (frame) => frame >= frameTo;
            const update = sign > 0 ? (frame) => frame + 1 : (frame) => frame - 1;
            for (let frame = frameFrom; predicate(frame); frame = update(frame)) {
                // First prepare all data for the frame
                // Consider all shapes, tags, and not outside tracks that have keyframe here
                // In particular consider first and last frame as keyframes for all tracks
                const statesData = [].concat(
                    (frame in this.shapes ? this.shapes[frame] : [])
                        .filter((shape) => !shape.removed)
                        .map((shape) => shape.get(frame)),
                    (frame in this.tags ? this.tags[frame] : [])
                        .filter((tag) => !tag.removed)
                        .map((tag) => tag.get(frame)),
                );
                const tracks = Object.values(this.tracks)
                    .filter((track) => (
                        frame in track.shapes || frame === frameFrom ||
                        frame === frameTo || linearSearch))
                    .filter((track) => !track.removed);
                statesData.push(...tracks.map((track) => track.get(frame)).filter((state) => !state.outside));

                // Nothing to filtering, go to the next iteration
                if (!statesData.length) {
                    continue;
                }

                // Filtering
                const filtered = this.annotationsFilter.filter(statesData, filters);
                if (filtered.length) {
                    return frame;
                }
            }

            return null;
        }
    }

    module.exports = ProjectionCollection;
})();
