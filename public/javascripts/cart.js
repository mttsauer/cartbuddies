$( document ).ready(function() {
    console.log( "ready!" );
    checkStatus();
});

var i = 0;

checkStatus = function(){
    $.ajax({
        url: "/cart", 
        success: function(result, textStatus){
            if(result) {
                if(result.redirect) window.location.replace(result.redirect);
                $("#message").html(result.message);
                if(result.delay > 0) {
                    setTimeout(checkStatus, result.delay);
                    $("#count").html(i++);
                }
            }
        },
        error: function(result, textStatus){
            console.log(textStatus);
        }
    });
}