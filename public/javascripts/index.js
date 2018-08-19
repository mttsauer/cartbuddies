var i = 0;

submit = function(){
    $.ajax({
        url: "/cart",
        method: "POST",
        formdata: $('form')[0],
        success: function(result, textStatus){
            checkStatus();
        },
        error: function(result, textStatus){
            console.log(textStatus);
        }
    });
}

checkStatus = function(){
    $.ajax({
        url: "/cart", 
        success: function(result, textStatus){
            if(result) {
                if(result.redirect) window.location.replace(result.redirect);
                $("#message").html(result.message);
                if(result.delay > 0) {
                    setTimeout(checkStatus, result.delay);
                    $("#count").html(''+ i++ + ':' + result.count);
                }
            }
        },
        error: function(result, textStatus){
            console.log(textStatus);
        }
    });
}

$( document ).ready(function() {
    if( $('#command')[0].value === 'checkStatus' ) checkStatus();
});