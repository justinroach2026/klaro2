import { defaultUrlTransform } from 'react-markdown';
import SopMarkdownImage from './SopImage';
import { SOP_IMAGE_SCHEME } from '../lib/video/compose';

const sopUrlTransform = (url: string) => (url.startsWith(SOP_IMAGE_SCHEME) ? url : defaultUrlTransform(url));

/** Spread onto <ReactMarkdown> wherever SOP content is shown. */
export const sopMarkdownProps = {
    components: { img: SopMarkdownImage },
    urlTransform: sopUrlTransform,
};
