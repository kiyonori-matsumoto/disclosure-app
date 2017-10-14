import { NgModule } from '@angular/core';
import { TagCountPipe } from './tag-count/tag-count';
import { KeysPipe } from './keys/keys';
@NgModule({
	declarations: [TagCountPipe,
    KeysPipe],
	imports: [],
	exports: [TagCountPipe,
    KeysPipe]
})
export class PipesModule {}
