import React, { useState } from 'react';
import { FiMic, FiMicOff, FiEdit2, FiCheck, FiX, FiActivity } from 'react-icons/fi';
import { useTranscription } from '../../hooks/use-transcription';

interface TranscriptionDisplayProps {
  type?: 'input' | 'output';
  allowEdit?: boolean;
  onTranscriptEdit?: (newTranscript: string) => void;
}

export const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  type = 'input',
  allowEdit = true,
  onTranscriptEdit
}) => {
  const { inputTranscription, outputTranscription, isRecording } = useTranscription();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const transcription = type === 'input' ? inputTranscription : outputTranscription;
  const isInputType = type === 'input';

  const startEdit = () => {
    setEditText(transcription.currentTranscript);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditText('');
  };

  const saveEdit = () => {
    if (onTranscriptEdit) {
      onTranscriptEdit(editText);
    }
    setIsEditing(false);
    setEditText('');
  };

  const getStatusText = () => {
    if (isInputType && isRecording) return '錄音中...';
    if (transcription.isTranscribing) return '轉錄中...';
    if (transcription.status === 'complete') return '轉錄完成';
    if (transcription.status === 'recording') return '錄音中...';
    if (transcription.status === 'processing') return '處理中...';
    if (transcription.error) return '轉錄錯誤';
    return '待開始';
  };

  const getStatusIcon = () => {
    if (isInputType && isRecording) return <FiMic className="recording" />;
    if (transcription.isTranscribing) return <FiActivity className="transcribing" />;
    if (transcription.status === 'complete') return <FiMic className="complete" />;
    if (transcription.error) return <FiMicOff className="error" />;
    return <FiMicOff />;
  };

  const hasContent = transcription.currentTranscript.trim().length > 0;

  return (
    <div className={`transcription-display ${type}`}>
      <div className="transcription-header">
        <div className="transcription-status">
          {getStatusIcon()}
          <span className="status-text">{getStatusText()}</span>
          <span className="type-label">
            {type === 'input' ? '用戶語音' : 'AI 回應'}
          </span>
        </div>
        
        {allowEdit && hasContent && !isEditing && type === 'input' && (
          <button
            className="edit-button"
            onClick={startEdit}
            aria-label="編輯轉錄文字"
          >
            <FiEdit2 />
          </button>
        )}
      </div>
      
      <div className="transcription-content">
        {isEditing ? (
          <div className="edit-mode">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="edit-textarea"
              placeholder="編輯轉錄文字..."
              rows={3}
              autoFocus
            />
            <div className="edit-actions">
              <button
                className="save-button"
                onClick={saveEdit}
                aria-label="保存編輯"
              >
                <FiCheck />
              </button>
              <button
                className="cancel-button"
                onClick={cancelEdit}
                aria-label="取消編輯"
              >
                <FiX />
              </button>
            </div>
          </div>
        ) : (
          <>
            {hasContent ? (
              <p className="transcript-text">{transcription.currentTranscript}</p>
            ) : (
              <p className="transcription-placeholder">
                {isInputType 
                  ? (isRecording ? '開始說話...' : '點擊麥克風開始錄音') 
                  : 'AI 回應將在這裡顯示...'}
              </p>
            )}
            
            {transcription.error && (
              <div className="error-message">
                <span>錯誤: {transcription.error}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};