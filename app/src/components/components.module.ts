import { NgModule } from '@angular/core';
import { MyPdfViewerComponent } from './my-pdf-viewer/my-pdf-viewer';
import { IonicModule } from 'ionic-angular';
@NgModule({
	declarations: [MyPdfViewerComponent],
	imports: [IonicModule],
	exports: [MyPdfViewerComponent]
})
export class ComponentsModule {}
