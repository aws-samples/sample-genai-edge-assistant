// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { MarkerType } from 'reactflow';

export const initialPrompt_1 = [
  { static: 'Is there ', editable: 'a massive and red carpet', key: 'word1' },
  { static: ' on the image?', editable: null, key: 'word2' },
];

export const initialPrompt_2 = [
  {
    static:
      'If the taken picture was a human being vision, would he already be ',
    editable: 'standing on the red carpet',
    key: 'word1',
  },
  { static: '?', editable: null, key: 'word2' },
];

export const initialPrompt_3 = [
  {
    static:
      'You have perfect vision and pay great attention to detail which makes you an expert at recognizing ',
    editable: 'the direction in which objects are going in images',
    key: 'word1',
  },
  {
    static:
      '.You are provided with pictures taken from a camera, all that is in the upper part of the image is further away. You do not need to perform text analysis on the image.',
    editable: null,
    key: 'word2',
  },
  {
    static:
      'You always want to move further away from your original location and ',
    editable: 'follow the red carpet',
    key: 'word3',
  },
  {
    static: '. What is the',
    editable: ' direction of the red carpet',
    key: 'word4',
  },
  {
    static:
      ' in the picture? Before providing the answer think step by step and analyze every part and object of the image.',
    editable: null,
    key: 'word5',
  },
];

export const initialPrompt_4 = [
  {
    static: 'Where do I need to move to reach ',
    editable: 'the carpet',
    key: 'word1',
  },
  { static: ':', editable: 'Left, Right, Forward', key: 'word2' },
  { static: '?', editable: null, key: 'word3' },
];

export const initialNodes = [
  {
    id: 'prompt1',
    type: 'input',
    position: { x: 250, y: 0 },
    data: { label: 'Prompt 1 - Object?' },
  },
  {
    id: 'prompt2',
    position: { x: 100, y: 100 },
    data: { label: 'Prompt 2 - Away?' },
  },
  {
    id: 'prompt3',
    position: { x: 0, y: 200 },
    data: { label: 'Prompt 3 - Follow' },
  },
  {
    id: 'prompt4',
    position: { x: 200, y: 200 },
    data: { label: 'Prompt 4 - Reach' },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 100 },
    data: { label: 'End' },
  },
  {
    id: 'endp3',
    type: 'output',
    position: { x: 0, y: 300 },
    data: { label: 'End' },
  },
  {
    id: 'endp4',
    type: 'output',
    position: { x: 200, y: 300 },
    data: { label: 'End' },
  },
];

export const initialEdges = [
  {
    id: 'p1-p2',
    source: 'prompt1',
    target: 'prompt2',
    label: 'Yes',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'p1-end',
    source: 'prompt1',
    target: 'end',
    label: 'No',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'p2-p3',
    source: 'prompt2',
    target: 'prompt3',
    label: 'No',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'p2-p4',
    source: 'prompt2',
    target: 'prompt4',
    label: 'Yes',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'p3-endp3',
    source: 'prompt3',
    target: 'endp3',
    label: 'Right OR Forward OR Left',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'p4-endp4',
    source: 'prompt4',
    target: 'endp4',
    label: 'Right OR Forward OR Left',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
  },
];

export const VIDEO_DISPLAY_COMMON_STYLE = {
  width: '100%',
  maxWidth: '640px',
  aspectRatio: '4 / 3',
};

export const COLOURS = [
  'rgba(244,67,54,1)',
  'rgba(233,30,99,1)',
  'rgba(156,39,176,1)',
  'rgba(103,58,183,1)',
  'rgba(63,81,181,1)',
  'rgba(33,150,243,1)',
  'rgba(3,169,244,1)',
  'rgba(0,188,212,1)',
  'rgba(0,150,136,1)',
  'rgba(76,175,80,1)',
  'rgba(139,195,74,1)',
  'rgba(205,220,57,1)',
  'rgba(255,235,59,1)',
  'rgba(255,193,7,1)',
];

export const STATUS_CONFIG = {
  initializing: { type: 'pending', label: 'Initializing' },
  connecting: { type: 'in-progress', label: 'Connecting to camera' },
  capturing: { type: 'success', label: 'Capturing frames' },
  error: { type: 'error', label: 'Error' },
};

export const WORKER_TO_MODEL_MAP = {
  detection: ['object-detection'],
  depth: ['depth'],
  imageCaptioning: ['image-captioning'],
  audio: ['tts', 'vocoder'],
};
