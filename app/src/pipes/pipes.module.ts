import { NgModule } from '@angular/core';
import { TagCountPipe } from './tag-count/tag-count';
import { KeysPipe } from './keys/keys';
import { ShortTimePipe } from './short-time/short-time';
import { MiddleTimePipe } from './middle-time/middle-time';
@NgModule({
	declarations: [TagCountPipe,
    KeysPipe,
    ShortTimePipe,
    MiddleTimePipe],
	imports: [],
	exports: [TagCountPipe,
    KeysPipe,
    ShortTimePipe,
    MiddleTimePipe]
})
export class PipesModule {}
