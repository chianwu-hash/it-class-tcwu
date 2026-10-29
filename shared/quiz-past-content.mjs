import {renderContent} from './quiz-render.mjs';
export const renderLocalContent=(host,content)=>renderContent(host,content,{imageLoading:'lazy'});
