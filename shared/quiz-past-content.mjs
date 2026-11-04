import {renderContent} from './quiz-render.mjs';
export const renderLocalContent=(host,content,options={})=>renderContent(host,content,{imageLoading:'lazy',...options});
