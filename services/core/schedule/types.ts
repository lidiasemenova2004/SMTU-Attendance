// parser/types.ts

export interface Lesson {
    timeIn: string,
    timeOut: string,
    week: 'up' | 'down' | 'both';
    group: string;
    subject: string;
    kind: 'lecture' | 'practice' | 'lab';
    teacher: string;
    building: string;
    audience: string;
  }
  
  export interface ScheduleData {
    [building: string]: {
      [audience: string]: (Lesson | null)[][];
    };
  }

  