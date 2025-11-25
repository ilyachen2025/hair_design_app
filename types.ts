import React from 'react';

export interface HairStyleOption {
  id: string;
  label: string;
  prompt: string;
  category: 'style' | 'color' | 'creative';
}

export interface GenerationResult {
  imageUrl: string | null;
  text?: string;
}

export interface GeneratedPreview {
  styleId: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  imageUrl?: string;
  error?: string;
}

export enum AppState {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  READY_TO_GENERATE = 'READY_TO_GENERATE',
  BATCH_GENERATING = 'BATCH_GENERATING',
  REFINING = 'REFINING', // Applying color to selected style
  CUSTOM_GENERATING = 'CUSTOM_GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}