var injectConfig = function injectConfig(app,html,data,object){
    object = object || app.object;
    const moduleId = data.moduleId;
    let injectPoint
    if(typeof data.inject === "string"){
        injectPoint = html.find(data.inject).first().closest(".form-group");
    }else{
        injectPoint = data.inject;
    }
    injectPoint = $(injectPoint) || html.find(".form-group").last();
    let injectHtml = "";
    for(const [k,v] of Object.entries(data)){
        if(k === "moduleId" || k === "inject") continue;
        const elemData = data[k];
        const flag = "flags." + moduleId + "." + (k || "");
        const flagValue = object.getFlag(moduleId, k) ?? elemData.default ?? getDefaultFlag(k);
        switch(elemData.type){
            case "text":
                injectHtml += `<div class="form-group">
                    <label for="${k}">${v.label || ""}</label>
                        <input type="text" name="${flag}" value="${flagValue}" placeholder="${v.placeholder || ""}">
                </div>`;
                break;
            case "number":
                injectHtml += `<div class="form-group">
                    <label for="${k}">${v.label || ""}</label>
                        <input type="number" name="${flag}" value="${flagValue}" placeholder="${v.placeholder || ""}">
                </div>`;
                break;
            case "checkbox": 
                injectHtml += `<div class="form-group">
                    <label for="${k}">${v.label || ""}</label>
                        <input type="checkbox" name="${flag}" ${flagValue ? "checked" : ""}>
                </div>`;
                break;
            case "select":
                injectHtml += `<div class="form-group">
                    <label for="${k}">${v.label || ""}</label>
                        <select name="${flag}">`;
                for(const [i,j] of Object.entries(v.options)){
                    injectHtml += `<option value="${i}" ${flagValue === i ? "selected" : ""}>${j}</option>`;
                }
                injectHtml += `</select>
                </div>`;
                break;
            case "range":
                injectHtml += `<div class="form-group">
                    <label for="${k}">${v.label || ""}</label>
                    <div class="form-fields">
                        <input type="range" name="${flag}" value="${flagValue}" min="${v.min}" max="${v.max}">
                        <span class="range-value">${flagValue}</span>
                    </div>
                </div>`;
                break;
            case "color":
                injectHtml += `<div class="form-group">
                    <label for="${k}">${v.label || ""}</label>
                    <div class="form-fields">
                        <input class="color" type="text" name="${flag}" value="${flagValue}">
                        <input type="color" data-edit="${flag}" value="${flagValue}">
                    </div>
                </div>`;
                break;
        }
        if(elemData.type.includes("filepicker")){
            const fpType = elemData.type.split(".")[1] || "imagevideo";
            injectHtml += `<div class="form-group">
            <label for="${k}">${v.label || ""}</label>
            <div class="form-fields">     
                <button type="button" class="file-picker" data-type="${fpType}" data-target="${flag}" title="Browse Files" tabindex="-1">
                    <i class="fas fa-file-import fa-fw"></i>
                </button>
                <input class="image" type="text" name="${flag}" placeholder="${v.placeholder || ""}" value="${flagValue}">
            </div>
        </div>`;
        }
    }
    injectHtml = $(injectHtml);
    injectHtml.on("click", ".file-picker", _activateFilePicker);
    injectHtml.on("change", `input[type="color"]`, _colorChange);
    injectPoint.after(injectHtml);
    app.setPosition({"height" : "auto"});
    return html;


    function getDefaultFlag(inputType){
        switch(inputType){
            case "text":
                return "";
            case "number":
                return 0;
            case "checkbox":
                return false;
            case "select":
                return "";
        }
    }

    function _colorChange(e){
        const input = $(e.target);
        const edit = input.data("edit");
        const value = input.val();
        injectHtml.find(`input[name="${edit}"]`).val(value);
    }

    function _activateFilePicker(event) {
    event.preventDefault();
    const options = _getFilePickerOptions(event);
    const fp = new FilePicker(options);
    return fp.browse();
    }

    function _getFilePickerOptions(event) {
    const button = event.currentTarget;
    const field = $(button).closest(".form-fields").find("input") || null;
    return {
        field: field[0],
        type: button.dataset.type,
        current: field.val() || null,
        button: button,
    }
    }

};

Hooks.on("renderTokenConfig", (app,html)=>{
    injectConfig(app,html,{
        moduleId : "mmm",
        inject : `select[name="displayName"]`,
        "tokenColor": {
            "type": "color",
            "label": "Token Color",
            "default": "#ffffff",
            "placeholder": "#ffffff"
        },
        "tokenRange" : {
            "label" : "Token Range",
            "type" : "range",
            "min" : 0,
            "max" : 100,
            "default" : 0,

        },
        "tokenCheck" : {
            type : "checkbox",
            label : "Token Check",
            default : true
        },
        "tokenimg": {
            type : "filepicker",
            label : "Token Image",
            default : "",
            placeholder : "Token Image"
        },
        "tokenName" : {
            "type" : "text",
            "label" : "Token Name",
            "placeholder" : "Token Name"
        },
        "tokenValue" : {
            "type" : "text",
            "label" : "Token Value",
            "placeholder" : "Token Value"
        },
        "tokenType" : {
            "type" : "select",
            "label" : "Token Type",
            "options" : {
                "string" : "String",
                "number" : "Number",
                "boolean" : "Boolean"
            }
        },
        "tokenDescription" : {
            "type" : "text",
            "label" : "Token Description",
            "placeholder" : "Token Description"
        },
        "tokenSize" : {
            "type" : "number",
            "label" : "Token Size",
        }

    });
});