import { NgModule } from '@angular/core';
import { TagCountPipe } from './tag-count/tag-count';
import { KeysPipe } from './keys/keys';
import { ShortTimePipe } from './short-time/short-time';
@NgModule({
	declarations: [TagCountPipe,
    KeysPipe,
    ShortTimePipe],
	imports: [],
	exports: [TagCountPipe,
    KeysPipe,
    ShortTimePipe]
})
export class PipesModule {}
